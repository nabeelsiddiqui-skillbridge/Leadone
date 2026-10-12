"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  previewUrl: string | null;
}

/**
 * Loaded from the agent's own request path (/api/agents/elevenlabs-voices)
 * rather than baked in like VoicePicker's OpenAI list - ElevenLabs' voice
 * catalog is per-account (custom/cloned voices included), so it has to be
 * fetched live rather than hardcoded.
 */
export function ElevenLabsVoicePicker({ value, onChange }: { value: string; onChange: (voiceId: string) => void }) {
  const [voices, setVoices] = useState<ElevenLabsVoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agents/elevenlabs-voices")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        setVoices(data.voices ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load ElevenLabs voices.");
      });
    return () => {
      cancelled = true;
      audioRef.current?.pause();
    };
  }, []);

  function handlePreview(voice: ElevenLabsVoice, e: React.MouseEvent) {
    e.stopPropagation();
    if (!voice.previewUrl) return;

    if (playingVoice === voice.voiceId) {
      audioRef.current?.pause();
      setPlayingVoice(null);
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(voice.previewUrl);
    audioRef.current = audio;
    audio.addEventListener("ended", () => setPlayingVoice(null));
    audio.play().catch(() => setPlayingVoice(null));
    setPlayingVoice(voice.voiceId);
  }

  if (error) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
        {error} Add your ElevenLabs API key in Super Admin → Settings → APIs first.
      </p>
    );
  }

  if (!voices) {
    return (
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Loading voices…
      </div>
    );
  }

  if (voices.length === 0) {
    return <p className="text-sm text-muted-foreground">No voices found on this ElevenLabs account.</p>;
  }

  return (
    <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
      {voices.map((voice) => {
        const isSelected = value === voice.voiceId;
        const isPlaying = playingVoice === voice.voiceId;
        return (
          <div
            key={voice.voiceId}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onClick={() => onChange(voice.voiceId)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(voice.voiceId);
              }
            }}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
              isSelected ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50"
            )}
          >
            <span className="min-w-0 truncate font-medium">{voice.name}</span>
            {voice.previewUrl && (
              <button
                type="button"
                onClick={(e) => handlePreview(voice, e)}
                className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-foreground hover:bg-muted"
                aria-label={isPlaying ? `Pause ${voice.name} preview` : `Play ${voice.name} preview`}
              >
                {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
