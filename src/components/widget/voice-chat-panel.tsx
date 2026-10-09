"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface VoiceChatPanelProps {
  widgetKey: string;
  name: string;
  primaryColor: string;
  active: boolean;
}

type CallState = "idle" | "connecting" | "live" | "ended" | "error";

/**
 * Encodes/decodes G.711 μ-law - the exact codec the realtime-voice server
 * already speaks with Twilio (see services/realtime-voice/src/openaiRealtime.ts,
 * `audio/pcmu`). Using the same codec end-to-end means this widget can talk
 * to the production /media-stream endpoint, speaking Twilio's own
 * "start"/"media"/"stop" JSON protocol, with zero changes to that server.
 */
const ULAW_BIAS = 0x84;
const ULAW_CLIP = 32635;

function linearToMulaw(sample: number): number {
  let s = Math.max(-ULAW_CLIP, Math.min(ULAW_CLIP, sample));
  const sign = s < 0 ? 0x80 : 0;
  if (sign) s = -s;
  s += ULAW_BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (s >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

const MULAW_DECODE_TABLE = (() => {
  const table = new Int16Array(256);
  for (let i = 0; i < 256; i++) {
    const byte = ~i & 0xff;
    const sign = byte & 0x80;
    const exponent = (byte >> 4) & 0x07;
    const mantissa = byte & 0x0f;
    let sample = ((mantissa << 3) + ULAW_BIAS) << exponent;
    sample -= ULAW_BIAS;
    table[i] = sign ? -sample : sample;
  }
  return table;
})();

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

const TARGET_SAMPLE_RATE = 8000;
const FRAME_SAMPLES = 160; // 20ms at 8kHz, matching Twilio's own frame cadence

export function VoiceChatPanel({ widgetKey, name, primaryColor, active }: VoiceChatPanelProps) {
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const pendingSamplesRef = useRef<number[]>([]);
  const mutedRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    // Leaving the voice tab (or closing the widget) must tear the call down -
    // an open mic + open WebSocket left running in the background is both a
    // privacy problem and an unbounded OpenAI Realtime API cost.
    if (!active && state !== "idle") {
      endCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => () => endCall(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function clearPlaybackQueue() {
    for (const source of scheduledSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // already stopped/played
      }
    }
    scheduledSourcesRef.current = [];
    nextPlayTimeRef.current = audioContextRef.current?.currentTime ?? 0;
  }

  function playIncomingUlaw(base64Payload: string) {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    const ulawBytes = base64ToBytes(base64Payload);
    const buffer = ctx.createBuffer(1, ulawBytes.length, TARGET_SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < ulawBytes.length; i++) {
      channel[i] = MULAW_DECODE_TABLE[ulawBytes[i]] / 32768;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(nextPlayTimeRef.current, ctx.currentTime);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + buffer.duration;

    scheduledSourcesRef.current.push(source);
    source.onended = () => {
      scheduledSourcesRef.current = scheduledSourcesRef.current.filter((s) => s !== source);
    };

    setAgentSpeaking(true);
    if (agentSpeakingTimeoutRef.current) clearTimeout(agentSpeakingTimeoutRef.current);
    agentSpeakingTimeoutRef.current = setTimeout(() => setAgentSpeaking(false), 400);
  }
  const agentSpeakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function startCall() {
    setErrorMessage(null);
    setState("connecting");

    try {
      const res = await fetch(`/api/widget/${widgetKey}/voice-session`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start voice chat.");

      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = ctx;
      nextPlayTimeRef.current = ctx.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micStreamRef.current = stream;

      const ws = new WebSocket(data.wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            event: "start",
            start: {
              streamSid: crypto.randomUUID(),
              callSid: crypto.randomUUID(),
              customParameters: { callId: data.callId },
            },
          })
        );
        setState("live");
        startMicStreaming(ctx, stream, ws);
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        let message: { event?: string; media?: { payload?: string } };
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.event === "media" && message.media?.payload) {
          playIncomingUlaw(message.media.payload);
        } else if (message.event === "clear") {
          clearPlaybackQueue();
        }
      };

      ws.onerror = () => {
        setErrorMessage("Connection lost. Please try again.");
        setState("error");
        cleanupAudio();
      };

      ws.onclose = () => {
        setState((prev) => (prev === "error" ? prev : "ended"));
        cleanupAudio();
      };
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Couldn't start voice chat.");
      setState("error");
      cleanupAudio();
    }
  }

  function startMicStreaming(ctx: AudioContext, stream: MediaStream, ws: WebSocket) {
    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;

    // ScriptProcessorNode is deprecated but universally supported and needs
    // no separate worklet module to load inside the widget's iframe -
    // reliability here matters more than avoiding the deprecation warning.
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    const decimation = Math.max(1, Math.round(ctx.sampleRate / TARGET_SAMPLE_RATE));

    processor.onaudioprocess = (event) => {
      if (mutedRef.current || ws.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);

      let peak = 0;
      const pending = pendingSamplesRef.current;
      for (let i = 0; i < input.length; i += decimation) {
        const sample = input[i];
        peak = Math.max(peak, Math.abs(sample));
        pending.push(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))));
      }
      setLevel(peak);

      while (pending.length >= FRAME_SAMPLES) {
        const frame = pending.splice(0, FRAME_SAMPLES);
        const ulaw = new Uint8Array(FRAME_SAMPLES);
        for (let i = 0; i < FRAME_SAMPLES; i++) ulaw[i] = linearToMulaw(frame[i]);
        ws.send(JSON.stringify({ event: "media", media: { payload: bytesToBase64(ulaw) } }));
      }
    };

    // ScriptProcessorNode only fires onaudioprocess once connected into the
    // graph, but the mic audio itself must never reach the speakers (that
    // would echo the visitor's own voice back to them) - route it into a
    // zero-gain node instead of ctx.destination.
    const silentSink = ctx.createGain();
    silentSink.gain.value = 0;
    source.connect(processor);
    processor.connect(silentSink);
    silentSink.connect(ctx.destination);
  }

  function cleanupAudio() {
    try {
      processorRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      sourceRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    pendingSamplesRef.current = [];
    clearPlaybackQueue();
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
  }

  function endCall() {
    try {
      wsRef.current?.send(JSON.stringify({ event: "stop" }));
    } catch {
      /* socket already gone */
    }
    try {
      wsRef.current?.close();
    } catch {
      /* already closed */
    }
    wsRef.current = null;
    cleanupAudio();
    setState((prev) => (prev === "idle" ? prev : "ended"));
    setAgentSpeaking(false);
  }

  const orbScale = state === "live" ? 1 + Math.min(level * 2.2, 0.35) + (agentSpeaking ? 0.12 : 0) : 1;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-gray-50 px-6 py-8">
      <div className="relative flex h-32 w-32 items-center justify-center">
        {(state === "live" || state === "connecting") && (
          <span
            className="absolute inset-0 animate-ping rounded-full opacity-20"
            style={{ backgroundColor: primaryColor }}
          />
        )}
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.45)] transition-transform duration-150 ease-out"
          style={{
            backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
            transform: `scale(${orbScale})`,
          }}
        >
          {state === "connecting" ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : state === "live" ? (
            muted ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm font-medium text-gray-900">
          {state === "idle" && `Talk to ${name}`}
          {state === "connecting" && "Connecting…"}
          {state === "live" && (agentSpeaking ? `${name} is speaking…` : "Listening…")}
          {state === "ended" && "Call ended"}
          {state === "error" && "Something went wrong"}
        </p>
        {state === "idle" && <p className="mt-1 text-xs text-gray-500">Tap below to start a live voice conversation.</p>}
        {errorMessage && <p className="mt-1 text-xs text-red-500">{errorMessage}</p>}
      </div>

      {state === "idle" || state === "ended" || state === "error" ? (
        <button
          type="button"
          onClick={startCall}
          className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.03]"
          style={{ backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
        >
          <Mic className="h-4 w-4" />
          {state === "idle" ? "Start voice chat" : "Call again"}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute" : "Mute"}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition-colors",
              muted ? "border-gray-300 bg-white text-gray-700" : "border-transparent bg-white text-gray-700 hover:bg-gray-100"
            )}
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={endCall}
            aria-label="End call"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-transform hover:scale-105"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
