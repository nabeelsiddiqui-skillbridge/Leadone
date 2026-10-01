import { EventEmitter } from "node:events";
import WebSocket from "ws";

import { config } from "./config.js";
import { TOOL_DEFINITIONS } from "./tools/index.js";

export interface RealtimeSessionOptions {
  instructions: string;
  voice: string;
  toolsEnabled: boolean;
  /** Hard cap on a single response's length, per the agent's response_length setting — see promptBuilder.maxOutputTokensForAgent. */
  maxOutputTokens: number | "inf";
  /** Let the server itself cancel an in-progress response the instant it detects the caller speaking, rather than relying solely on our own speechStarted handling. */
  interruptOnSpeech: boolean;
}

interface FunctionCallAccumulator {
  callId: string;
  name: string;
  argsJson: string;
}

/**
 * One WebSocket connection to the OpenAI Realtime API, for exactly one
 * phone call. Talks g711_ulaw in both directions so audio frames from
 * Twilio can be forwarded byte-for-byte with no transcoding — see the
 * README for why that matters for latency.
 *
 * Emits: "audioDelta" (base64 ulaw chunk), "audioDone", "speechStarted",
 * "callerTranscript" (final text), "agentTranscript" (final text),
 * "functionCall" ({ callId, name, args }), "responseDone", "error", "close".
 */
export class OpenAIRealtimeSession extends EventEmitter {
  private ws: WebSocket | null = null;
  private pendingFunctionCalls = new Map<string, FunctionCallAccumulator>();
  private firstAudioDeltaSentForResponse = false;

  connect(options: RealtimeSessionOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      // No "OpenAI-Beta: realtime=v1" header - that activates OpenAI's now-
      // retired beta protocol shape (removed 2026-05-07; the API rejects it
      // with error code "beta_api_shape_disabled"). Plain /v1/realtime with
      // just the model query param is the current GA connection.
      const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(config.defaultRealtimeModel)}`;
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
      });

      this.ws.once("open", () => {
        console.log(`OpenAI realtime socket open (model=${config.defaultRealtimeModel})`);
        this.sendSessionUpdate(options);
        resolve();
      });
      this.ws.once("error", (err) => {
        console.error(`OpenAI realtime socket failed to open (model=${config.defaultRealtimeModel}):`, err);
        reject(err);
      });

      this.ws.on("message", (raw) => this.handleMessage(raw));
      this.ws.on("close", (code, reason) => this.emit("close", code, reason?.toString() ?? ""));
      this.ws.on("error", (err) => this.emit("error", err));
    });
  }

  private send(payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private sendSessionUpdate(options: RealtimeSessionOptions) {
    // GA session shape (see node_modules/openai/src/resources/realtime/realtime.ts
    // RealtimeSessionCreateRequest): requires session.type, nests audio config
    // under audio.input/audio.output (each with an object `format`, not the old
    // flat "g711_ulaw" string), renames modalities -> output_modalities (and
    // audio+text together is no longer offered - "audio" alone already
    // includes a transcript), and drops the old top-level `temperature` field
    // entirely (not part of the GA session schema) - see promptBuilder's
    // creativityRule() for where "creativity" is actually enforced now.
    this.send({
      type: "session.update",
      session: {
        type: "realtime",
        instructions: options.instructions,
        output_modalities: ["audio"],
        max_output_tokens: options.maxOutputTokens,
        audio: {
          input: {
            format: { type: "audio/pcmu" },
            transcription: { model: "whisper-1" },
            // Filters the input before it ever reaches VAD/the model. This is
            // what cuts down the model tripping over line noise, its own
            // echo bleeding back through the caller's phone speaker, or
            // ambient background sound and stopping mid-sentence as if it
            // had been interrupted - OpenAI's own docs describe this as
            // directly reducing VAD false positives. "near_field" matches a
            // phone handset better than "far_field" (laptop/conference mic).
            noise_reduction: { type: "near_field" },
            turn_detection: {
              type: "server_vad",
              // Back at the default 0.5 - raising this to 0.6 was meant to
              // ignore line noise/echo, but it also raised the bar for real
              // caller speech and stopped genuine barge-in from registering
              // ("not allow user to talk"). noise_reduction above is the
              // correct lever for the echo/noise problem - it filters the
              // input before VAD ever sees it, so the threshold itself
              // doesn't need to be detuned away from a level that works for
              // real speech.
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
              // Cancel the model's in-progress response server-side the
              // instant the caller starts talking, instead of waiting for
              // our own speechStarted handler to do it client-side - this
              // is what was making the agent "talk but not listen" when a
              // caller tried to interrupt.
              interrupt_response: options.interruptOnSpeech,
            },
          },
          output: {
            format: { type: "audio/pcmu" },
            voice: options.voice,
            // Left at the model's default (1.0). 1.15x made speech sound
            // noticeably robotic/rushed - this parameter is a post-hoc
            // playback-rate stretch, not a "speak faster" instruction to
            // the model, and it doesn't hold up well on already-compressed
            // phone audio. If pacing still feels off, that's better solved
            // in the agent's own prompt/instructions than by speeding up
            // the raw audio.
          },
        },
        tools: options.toolsEnabled ? TOOL_DEFINITIONS : [],
        tool_choice: options.toolsEnabled ? "auto" : "none",
      },
    });
  }

  /** Caller audio in from Twilio: base64 g711_ulaw payload, forwarded as-is. */
  appendAudio(base64Audio: string) {
    this.send({ type: "input_audio_buffer.append", audio: base64Audio });
  }

  /** Barge-in: stop the model mid-response. Pair with a Twilio `clear` event. */
  cancelResponse() {
    this.send({ type: "response.cancel" });
  }

  createResponse(instructionsOverride?: string) {
    this.firstAudioDeltaSentForResponse = false;
    this.send({
      type: "response.create",
      ...(instructionsOverride ? { response: { instructions: instructionsOverride } } : {}),
    });
  }

  /**
   * Opens the call with the agent's configured greeting.
   *
   * This used to conversation.item.create a fake prior assistant message
   * containing the greeting text, then call response.create right after.
   * That never spoke the greeting at all: conversation.item.create only
   * inserts a text item into history, it does not synthesize audio for it -
   * and the immediately following response.create then asked the model for
   * the NEXT turn, treating that inserted item as something it had already
   * said. The model would invent a plausible follow-up ("Sure, understood.
   * When would be a better time to reach you?") as its first spoken line,
   * which is exactly the "starts talking like it's already mid-conversation
   * and never says the actual script" behavior this was reported as.
   *
   * response.create's own per-response `instructions` field is the correct
   * tool for this: it's a one-time instruction override for that response
   * only, doesn't touch conversation history, and its output is a normal
   * generated (and so spoken) turn.
   */
  sendGreeting(text: string) {
    this.createResponse(
      `Start the call now. Your very first line must be this opening, said naturally rather than read word-for-word like a script: "${text}". Then continue the conversation based on how the caller responds.`
    );
  }

  sendFunctionCallOutput(callId: string, output: unknown) {
    this.send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(output),
      },
    });
    this.createResponse();
  }

  close() {
    this.ws?.close();
  }

  private handleMessage(raw: WebSocket.RawData) {
    let event: { type: string; [key: string]: unknown };
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (event.type) {
      case "session.created":
        this.emit("sessionCreated", (event.session as { id: string } | undefined)?.id ?? null);
        break;

      case "input_audio_buffer.speech_started":
        this.emit("speechStarted");
        break;

      case "input_audio_buffer.speech_stopped":
        this.emit("speechStopped");
        break;

      case "conversation.item.input_audio_transcription.completed":
        this.emit("callerTranscript", (event as { transcript?: string }).transcript ?? "");
        break;

      case "response.output_audio.delta": {
        if (!this.firstAudioDeltaSentForResponse) {
          this.firstAudioDeltaSentForResponse = true;
          this.emit("firstAudioDelta");
        }
        this.emit("audioDelta", (event as { delta?: string }).delta ?? "");
        break;
      }

      case "response.output_audio.done":
        this.emit("audioDone");
        break;

      case "response.output_audio_transcript.done":
        this.emit("agentTranscript", (event as { transcript?: string }).transcript ?? "");
        break;

      case "response.output_item.done": {
        const item = (event as { item?: { type?: string; call_id?: string; name?: string; arguments?: string } }).item;
        if (item?.type === "function_call" && item.call_id && item.name) {
          let args: unknown = {};
          try {
            args = JSON.parse(item.arguments ?? "{}");
          } catch {
            args = {};
          }
          this.emit("functionCall", { callId: item.call_id, name: item.name, args });
        }
        break;
      }

      case "response.done": {
        const usage = (event as { response?: { usage?: Record<string, unknown> } }).response?.usage;
        if (usage) this.emit("usage", usage);
        this.emit("responseDone");
        break;
      }

      case "error":
        this.emit("error", event.error ?? event);
        break;

      default:
        break;
    }
  }
}
