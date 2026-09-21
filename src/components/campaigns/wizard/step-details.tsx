"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { WizardState } from "./types";

export function StepDetails({
  state,
  update,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="campaign-name">Campaign name</Label>
        <Input
          id="campaign-name"
          value={state.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Q4 Outbound — Warm Leads"
          autoFocus
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="campaign-description">Description</Label>
        <Textarea
          id="campaign-description"
          value={state.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="What is this campaign for? (optional)"
          rows={4}
        />
      </div>
    </div>
  );
}
