import type WebSocket from "ws";

import { db } from "./db.js";
import { config } from "./config.js";
import { OpenAIRealtimeSession } from "./openaiRealtime.js";
import { executeTool } from "./tools/index.js";
import { buildSystemInstructions, buildOpeningGreeting } from "./promptBuilder.js";
import { runPostCallAnalysis } from "./postCallAnalysis.js";
import type { AgentRecord, CallSessionState, ContactRecord } from "./types.js";

export interface TwilioStartMessage {
  event: "start";
  start: { streamSid: string; callSid: string; customParameters?: Record<string, string> };
}
interface TwilioMediaMessage {
  event: "media";
  media: { payload: string };
}
interface TwilioStopMessage {
  event: "stop";
}
type TwilioMessage = TwilioStartMessage | TwilioMediaMessage | TwilioStopMessage | { event: string; [k: string]: unknown };

const DEFAULT_MAX_CALL_MS = 15 * 60 * 1000;

export class CallSession {
  private twilioWs: WebSocket;
  private openai = new OpenAIRealtimeSession();
  private state: CallSessionState;
  private agent: AgentRecord;
  private contact: ContactRecord | null;
  private finalized = false;
  private maxDurationTimer: NodeJS.Timeout | null = null;

  private constructor(twilioWs: WebSocket, state: CallSessionState, agent: AgentRecord, contact: ContactRecord | null) {
    this.twilioWs = twilioWs;
    this.state = state;
    this.agent = agent;
    this.contact = contact;
  }

  static async start(
    twilioWs: WebSocket,
    callId: string,
    start: { streamSid: string; callSid: string }
  ): Promise<CallSession | null> {
    const { data: call } = await db.from("calls").select("*").eq("id", callId).maybeSingle();
    if (!call) {
      console.error(`[call ${callId}] no matching calls row, refusing connection`);
      return null;
    }

    let agent: AgentRecord | null = null;
    if (call.agent_id) {
      const { data } = await db.from("agents").select("*").eq("id", call.agent_id).maybeSingle();
      agent = data as AgentRecord | null;
    }
    if (!agent) {
      console.error(`[call ${callId}] no agent configured, refusing connection`);
      return null;
    }

    let contact: ContactRecord | null = null;
    if (call.contact_id) {
      const { data } = await db.from("contacts").select("*").eq("id", call.contact_id).maybeSingle();
      contact = data as ContactRecord | null;
    }

    const state: CallSessionState = {
      callId,
      workspaceId: call.workspace_id,
      agentId: call.agent_id,
      campaignId: call.campaign_id,
      contactId: call.contact_id,
      twilioCallSid: start.callSid,
      twilioStreamSid: start.streamSid,
      openaiSessionId: null,
      callStartedAt: Date.now(),
      currentTurn: 0,
      agentSpeaking: false,
      callerSpeaking: false,
      toolState: {},
      appointmentState: {},
      transcriptTurn: 0,
      outcome: null,
      ended: false,
      currentTurnLatency: {},
    };

    const session = new CallSession(twilioWs, state, agent, contact);
    await session.init();
    return session;
  }

  private async init() {
    this.wireTwilioEvents();
    this.wireOpenAIEvents();

    await db
      .from("calls")
      .update({
        status: "in_progress",
        twilio_call_sid: this.state.twilioCallSid,
        twilio_stream_sid: this.state.twilioStreamSid,
        started_at: new Date().toISOString(),
        answered_at: new Date().toISOString(),
      })
      .eq("id", this.state.callId);

    await this.openai.connect({
      instructions: buildSystemInstructions(this.agent, this.contact),
      voice: this.agent.voice || config.defaultVoice,
      temperature: this.agent.creativity ?? 0.3,
      toolsEnabled: true,
    });

    const greeting = buildOpeningGreeting(this.agent, this.contact);
    if (greeting) {
      this.openai.sendGreeting(greeting);
    } else {
      this.openai.createResponse();
    }

    const maxMs = (this.agent.max_call_duration_seconds || DEFAULT_MAX_CALL_MS / 1000) * 1000;
    this.maxDurationTimer = setTimeout(() => {
      this.finalize("max_duration_reached");
    }, maxMs);
  }

  private wireTwilioEvents() {
    this.twilioWs.on("message", (raw) => this.handleTwilioMessage(raw));
    this.twilioWs.on("close", () => this.finalize(this.state.outcome ?? "caller_hung_up"));
    this.twilioWs.on("error", (err) => this.logEvent("twilio_socket_error", { message: err.message }));
  }

  private async handleTwilioMessage(raw: WebSocket.RawData) {
    let message: TwilioMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (message.event) {
      // No "start" case: Twilio sends exactly one "start" event per stream
      // connection, and it's already consumed in index.ts to resolve callId
      // (via its customParameters) before this session even exists.
      case "media": {
        const payload = (message as TwilioMediaMessage).media.payload;
        this.openai.appendAudio(payload);
        break;
      }
      case "stop":
        this.finalize(this.state.outcome ?? "completed");
        break;
      default:
        break;
    }
  }

  private sendTwilioMedia(base64Audio: string) {
    if (!this.state.twilioStreamSid) return;
    this.twilioWs.send(
      JSON.stringify({ event: "media", streamSid: this.state.twilioStreamSid, media: { payload: base64Audio } })
    );
  }

  private sendTwilioClear() {
    if (!this.state.twilioStreamSid) return;
    this.twilioWs.send(JSON.stringify({ event: "clear", streamSid: this.state.twilioStreamSid }));
  }

  private wireOpenAIEvents() {
    this.openai.on("sessionCreated", (id: string) => {
      this.state.openaiSessionId = id;
      db.from("calls").update({ openai_session_id: id }).eq("id", this.state.callId).then(() => {});
    });

    this.openai.on("speechStarted", () => {
      this.state.callerSpeaking = true;
      if (this.state.agentSpeaking && this.agent.interruptions_enabled) {
        // Barge-in: stop the model and flush whatever audio Twilio has queued.
        this.openai.cancelResponse();
        this.sendTwilioClear();
        this.state.agentSpeaking = false;
      }
    });

    this.openai.on("speechStopped", () => {
      this.state.callerSpeaking = false;
      this.state.currentTurnLatency.callerSpeechEndedAt = Date.now();
    });

    this.openai.on("firstAudioDelta", () => {
      this.state.agentSpeaking = true;
      if (this.state.currentTurnLatency.callerSpeechEndedAt) {
        this.state.currentTurnLatency.firstAudioAt = Date.now();
      }
    });

    this.openai.on("audioDelta", (base64: string) => {
      this.sendTwilioMedia(base64);
    });

    this.openai.on("audioDone", () => {
      this.state.agentSpeaking = false;
      this.flushTurnLatency();
    });

    this.openai.on("callerTranscript", (text: string) => {
      if (!text) return;
      void this.writeTranscript("caller", text);
    });

    this.openai.on("agentTranscript", (text: string) => {
      if (!text) return;
      void this.writeTranscript("agent", text);
    });

    this.openai.on("functionCall", async ({ callId, name, args }: { callId: string; name: string; args: unknown }) => {
      this.state.currentTurnLatency.toolStartedAt = Date.now();
      const result = await executeTool({ session: this.state, agent: this.agent, contact: this.contact }, name, args);
      this.state.currentTurnLatency.toolEndedAt = Date.now();
      this.openai.sendFunctionCallOutput(callId, result);

      if (name === "end_call" && this.state.ended) {
        setTimeout(() => this.finalize(this.state.outcome ?? "completed"), 1500);
      }
    });

    this.openai.on("usage", (usage: Record<string, unknown>) => {
      // Persisted per response rather than accumulated in memory so a crash
      // never loses usage data already billed by OpenAI; the usage rollup
      // (src/lib/pricing.ts + /api/cron/rollup-usage in the Next app) sums
      // these call_events rows per workspace/day.
      this.logEvent("openai_usage", usage);
    });

    this.openai.on("error", (err: unknown) => {
      this.logEvent("openai_error", { error: err });
    });

    this.openai.on("close", () => {
      if (!this.finalized) this.finalize(this.state.outcome ?? "error");
    });
  }

  private async writeTranscript(speaker: "caller" | "agent", message: string) {
    this.state.transcriptTurn += 1;
    await db.from("call_transcripts").insert({
      call_id: this.state.callId,
      workspace_id: this.state.workspaceId,
      turn_number: this.state.transcriptTurn,
      speaker,
      message,
    });
  }

  private flushTurnLatency() {
    const l = this.state.currentTurnLatency;
    if (!l.callerSpeechEndedAt) return;
    this.state.currentTurn += 1;

    const firstAudioLatencyMs = l.firstAudioAt ? l.firstAudioAt - l.callerSpeechEndedAt : null;
    const toolLatencyMs = l.toolStartedAt && l.toolEndedAt ? l.toolEndedAt - l.toolStartedAt : null;
    const totalTurnLatencyMs = firstAudioLatencyMs !== null ? firstAudioLatencyMs + (toolLatencyMs ?? 0) : null;

    void db.from("call_turns").insert({
      call_id: this.state.callId,
      turn_number: this.state.currentTurn,
      speaker: "agent",
      caller_speech_ended_at: new Date(l.callerSpeechEndedAt).toISOString(),
      first_audio_latency_ms: firstAudioLatencyMs,
      tool_latency_ms: toolLatencyMs,
      total_turn_latency_ms: totalTurnLatencyMs,
    });

    this.state.currentTurnLatency = {};
  }

  private logEvent(eventType: string, payload: Record<string, unknown>) {
    void db.from("call_events").insert({
      call_id: this.state.callId,
      workspace_id: this.state.workspaceId,
      event_type: eventType,
      payload,
    });
  }

  private async finalize(outcome: string) {
    if (this.finalized) return;
    this.finalized = true;
    if (this.maxDurationTimer) clearTimeout(this.maxDurationTimer);

    const durationSeconds = Math.round((Date.now() - this.state.callStartedAt) / 1000);

    try {
      this.openai.close();
    } catch {
      // already closed
    }
    try {
      this.twilioWs.close();
    } catch {
      // already closed
    }

    await db
      .from("calls")
      .update({
        status: "completed",
        outcome,
        duration_seconds: durationSeconds,
        ended_at: new Date().toISOString(),
      })
      .eq("id", this.state.callId);

    if (this.state.contactId) {
      await db.from("contacts").update({ last_called_at: new Date().toISOString() }).eq("id", this.state.contactId);
    }

    // Fire-and-forget: never let analysis latency delay tearing the call
    // down, and never let it throw back into this handler.
    void runPostCallAnalysis(this.state.callId);
  }
}
