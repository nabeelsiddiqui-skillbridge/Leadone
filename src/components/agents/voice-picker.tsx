"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

export interface VoiceOption {
  id: string;
  label: string;
  description: string;
  recommended?: boolean;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "marin", label: "Marin", description: "Newest generation — most natural and expressive", recommended: true },
  { id: "cedar", label: "Cedar", description: "Newest generation — warm, clear, and grounded", recommended: true },
  { id: "alloy", label: "Alloy", description: "Neutral and balanced" },
  { id: "ash", label: "Ash", description: "Warm, confident, and direct" },
  { id: "ballad", label: "Ballad", description: "Expressive, storytelling tone" },
  { id: "coral", label: "Coral", description: "Bright and friendly" },
  { id: "echo", label: "Echo", description: "Calm and measured" },
  { id: "sage", label: "Sage", description: "Smooth and professional" },
  { id: "shimmer", label: "Shimmer", description: "Energetic and upbeat" },
  { id: "verse", label: "Verse", description: "Natural, conversational" },
];

export function VoicePicker({ value, onChange }: { value: string; onChange: (voice: string) => void }) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const cache = urlCacheRef.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  async function handlePreview(voiceId: string, e: React.MouseEvent) {
    e.stopPropagation();

    if (playingVoice === voiceId) {
      audioRef.current?.pause();
      setPlayingVoice(null);
      return;
    }

    audioRef.current?.pause();

    const cached = urlCacheRef.current.get(voiceId);
    if (cached) {
      playUrl(voiceId, cached);
      return;
    }

    setLoadingVoice(voiceId);
    try {
      const res = await fetch(`/api/agents/voice-preview?voice=${voiceId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn't load preview.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      urlCacheRef.current.set(voiceId, url);
      playUrl(voiceId, url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load preview.");
    } finally {
      setLoadingVoice(null);
    }
  }

  function playUrl(voiceId: string, url: string) {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener("ended", () => setPlayingVoice(null));
    audio.play().catch(() => setPlayingVoice(null));
    setPlayingVoice(voiceId);
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {VOICE_OPTIONS.map((voice) => {
        const isSelected = value === voice.id;
        const isPlaying = playingVoice === voice.id;
        const isLoading = loadingVoice === voice.id;
        return (
          <div
            key={voice.id}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onClick={() => onChange(voice.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(voice.id);
              }
            }}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
              isSelected ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50"
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium">{voice.label}</span>
                {voice.recommended && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                    <Sparkles className="size-2.5" /> Recommended
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">{voice.description}</p>
            </div>
            <button
              type="button"
              onClick={(e) => handlePreview(voice.id, e)}
              disabled={isLoading}
              className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-foreground hover:bg-muted disabled:opacity-50"
              aria-label={isPlaying ? `Pause ${voice.label} preview` : `Play ${voice.label} preview`}
            >
              {isLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="size-3.5" />
              ) : (
                <Play className="size-3.5" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
