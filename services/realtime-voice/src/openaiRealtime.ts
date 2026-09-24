import { EventEmitter } from "node:events";
import WebSocket from "ws";

import { config } from "./config.js";
import { TOOL_DEFINITIONS } from "./tools/index.js";

export interface RealtimeSessionOptions {
  instructions: string;
  voice: string;
  temperature: number;
  toolsEnabled: boolean;
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
    // entirely (not part of the GA session schema).
    this.send({
      type: "session.update",
      session: {
        type: "realtime",
        instructions: options.instructions,
        output_modalities: ["audio"],
        audio: {
          input: {
            format: { type: "audio/pcmu" },
            transcription: { model: "whisper-1" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          },
          output: {
            format: { type: "audio/pcmu" },
            voice: options.voice,
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

  createResponse() {
    this.firstAudioDeltaSentForResponse = false;
    this.send({ type: "response.create" });
  }

  sendGreeting(text: string) {
    this.send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "assistant",
        // "output_text" per the GA assistant-message content shape (was
        // just "text" in the retired beta shape).
        content: [{ type: "output_text", text }],
      },
    });
    this.createResponse();
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
