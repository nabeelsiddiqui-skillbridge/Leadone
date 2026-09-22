"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
] as const;

export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePreset = searchParams.get("range") ?? "7d";

  function setPreset(key: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("range", key);
    next.delete("from");
    next.delete("to");
    router.push(`${pathname}?${next.toString()}`);
  }

  function setCustom(field: "from" | "to", value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("range", "custom");
    if (value) next.set(field, value);
    else next.delete(field);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <Button
          key={preset.key}
          size="sm"
          variant={activePreset === preset.key ? "default" : "outline"}
          onClick={() => setPreset(preset.key)}
        >
          {preset.label}
        </Button>
      ))}
      <div className={cn("flex items-center gap-2", activePreset === "custom" && "rounded-md ring-1 ring-ring/50")}>
        <Input
          type="date"
          className="w-40"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => setCustom("from", e.target.value)}
        />
        <span className="text-sm text-muted-foreground">to</span>
        <Input
          type="date"
          className="w-40"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => setCustom("to", e.target.value)}
        />
      </div>
    </div>
  );
}
