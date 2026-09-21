"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RETRY_EXCLUDED_STATUS_OPTIONS, type WizardState } from "./types";

const STATUS_LABELS: Record<string, string> = {
  do_not_call: "Do not call",
  wrong_number: "Wrong number",
  not_interested: "Not interested",
};

export function StepRetry({
  state,
  update,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}) {
  function toggleExcluded(status: string, checked: boolean) {
    const next = checked
      ? [...state.retryExcludedStatuses, status]
      : state.retryExcludedStatuses.filter((s) => s !== status);
    update({ retryExcludedStatuses: next });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="max-attempts">Max attempts per lead</Label>
          <Input
            id="max-attempts"
            type="number"
            min={1}
            value={state.maxAttempts}
            onChange={(e) => update({ maxAttempts: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="voicemail-action">On voicemail</Label>
          <Select
            value={state.voicemailAction}
            onValueChange={(value) => update({ voicemailAction: value as WizardState["voicemailAction"] })}
          >
            <SelectTrigger id="voicemail-action" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hang_up">Hang up</SelectItem>
              <SelectItem value="leave_message">Leave a message</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="retry-no-answer">Retry after no answer (minutes)</Label>
          <Input
            id="retry-no-answer"
            type="number"
            min={0}
            value={state.retryNoAnswerMinutes}
            onChange={(e) => update({ retryNoAnswerMinutes: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="retry-busy">Retry after busy (minutes)</Label>
          <Input
            id="retry-busy"
            type="number"
            min={0}
            value={state.retryBusyMinutes}
            onChange={(e) => update({ retryBusyMinutes: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="retry-failed">Retry after failed call (minutes)</Label>
          <Input
            id="retry-failed"
            type="number"
            min={0}
            value={state.retryFailedMinutes}
            onChange={(e) => update({ retryFailedMinutes: Number(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Never retry leads with these outcomes</Label>
        <div className="flex flex-wrap gap-4">
          {RETRY_EXCLUDED_STATUS_OPTIONS.map((status) => (
            <label key={status} className="flex items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={state.retryExcludedStatuses.includes(status)}
                onCheckedChange={(checked) => toggleExcluded(status, checked === true)}
              />
              {STATUS_LABELS[status]}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
