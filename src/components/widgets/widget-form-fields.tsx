"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { WidgetMode, WidgetSize } from "@/lib/supabase/database.types";

const COLOR_PRESETS = ["#1B4D3E", "#2563EB", "#7C3AED", "#DC2626", "#0891B2", "#111827"];

export interface WidgetFormDefaults {
  name?: string;
  agentId?: string | null;
  mode?: WidgetMode;
  size?: WidgetSize;
  primaryColor?: string;
  greetingMessage?: string;
  voiceChatEnabled?: boolean;
}

export function WidgetFormFields({
  agents,
  defaults,
}: {
  agents: { id: string; name: string }[];
  defaults?: WidgetFormDefaults;
}) {
  const [color, setColor] = useState(defaults?.primaryColor ?? "#1B4D3E");
  const [voiceChatEnabled, setVoiceChatEnabled] = useState(defaults?.voiceChatEnabled ?? false);

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="widget-name">Name</Label>
        <Input id="widget-name" name="name" defaultValue={defaults?.name} placeholder="Website support" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="widget-agent">Agent</Label>
        <Select name="agent_id" defaultValue={defaults?.agentId ?? undefined}>
          <SelectTrigger id="widget-agent" className="w-full">
            <SelectValue placeholder="Select an agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Powers the AI replies and, for call-enabled widgets, places the outbound call.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="widget-mode">Mode</Label>
          <Select name="mode" defaultValue={defaults?.mode ?? "chat"}>
            <SelectTrigger id="widget-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chat">Chat only</SelectItem>
              <SelectItem value="call">Call only</SelectItem>
              <SelectItem value="both">Chat & Call</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="widget-size">Size</Label>
          <Select name="size" defaultValue={defaults?.size ?? "standard"}>
            <SelectTrigger id="widget-size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="widget-color">Color</Label>
        <div className="flex items-center gap-3">
          <input
            id="widget-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 shrink-0 cursor-pointer rounded-md border"
          />
          <Input
            name="primary_color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-28 font-mono uppercase"
            maxLength={7}
          />
          <div className="flex items-center gap-1.5">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setColor(preset)}
                className="h-6 w-6 rounded-full border shadow-sm transition-transform hover:scale-110"
                style={{ backgroundColor: preset }}
                aria-label={`Use ${preset}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="widget-greeting">Greeting message</Label>
        <Textarea
          id="widget-greeting"
          name="greeting_message"
          defaultValue={defaults?.greetingMessage}
          placeholder="Hi! How can we help you today?"
          rows={2}
        />
      </div>

      <div className="flex flex-row items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="widget-voice-chat">Voice chat (beta)</Label>
          <p className="text-xs text-muted-foreground">
            Let visitors talk to the agent live through their mic, right in the widget — no phone number needed.
          </p>
        </div>
        <input type="hidden" name="voice_chat_enabled" value={voiceChatEnabled ? "on" : "off"} />
        <Switch id="widget-voice-chat" checked={voiceChatEnabled} onCheckedChange={setVoiceChatEnabled} />
      </div>
    </>
  );
}
