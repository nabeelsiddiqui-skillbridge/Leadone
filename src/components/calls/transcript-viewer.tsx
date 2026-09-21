"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TranscriptTurn {
  id: string;
  turn_number: number;
  speaker: "caller" | "agent" | "system";
  message: string;
  spoken_at: string;
}

export function TranscriptViewer({ turns }: { turns: TranscriptTurn[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return turns;
    const q = query.toLowerCase();
    return turns.filter((t) => t.message.toLowerCase().includes(q));
  }, [turns, query]);

  if (turns.length === 0) {
    return <p className="text-sm text-muted-foreground">No transcript recorded for this call.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search transcript…"
          className="pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto rounded-lg border p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching lines.</p>
        ) : (
          filtered.map((turn) => (
            <div
              key={turn.id}
              className={cn("flex flex-col gap-0.5 rounded-md px-3 py-2 text-sm", {
                "self-end bg-primary/10 text-right": turn.speaker === "agent",
                "self-start bg-muted": turn.speaker === "caller",
                "self-center bg-transparent text-xs text-muted-foreground italic": turn.speaker === "system",
              })}
              style={{ maxWidth: turn.speaker === "system" ? "100%" : "80%" }}
            >
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {turn.speaker} · {new Date(turn.spoken_at).toLocaleTimeString()}
              </span>
              <span>{turn.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
