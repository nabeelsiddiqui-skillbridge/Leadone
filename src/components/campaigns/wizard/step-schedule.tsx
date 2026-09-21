"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAY_LABELS, type WizardState } from "./types";

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "UTC",
];

export function StepSchedule({
  state,
  update,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}) {
  function toggleDay(day: number, checked: boolean) {
    const days = checked
      ? [...state.daysOfWeek, day].sort((a, b) => a - b)
      : state.daysOfWeek.filter((d) => d !== day);
    update({ daysOfWeek: days });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-2">
        <Label>Timezone</Label>
        <RadioGroup
          value={state.timezoneMode}
          onValueChange={(value) => update({ timezoneMode: value as WizardState["timezoneMode"] })}
          className="flex flex-col gap-2 sm:flex-row sm:gap-6"
        >
          <label className="flex items-center gap-2 text-sm font-normal">
            <RadioGroupItem value="contact_local" id="tz-local" />
            Each contact&apos;s local time
          </label>
          <label className="flex items-center gap-2 text-sm font-normal">
            <RadioGroupItem value="fixed" id="tz-fixed" />
            Fixed timezone
          </label>
        </RadioGroup>
        {state.timezoneMode === "fixed" && (
          <Select value={state.fixedTimezone} onValueChange={(value) => update({ fixedTimezone: value })}>
            <SelectTrigger className="mt-2 w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Days of week</Label>
        <div className="flex flex-wrap gap-4">
          {DAY_LABELS.map((label, day) => (
            <label key={label} className="flex items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={state.daysOfWeek.includes(day)}
                onCheckedChange={(checked) => toggleDay(day, checked === true)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="calling-start-time">Calling window start</Label>
          <Input
            id="calling-start-time"
            type="time"
            value={state.callingStartTime}
            onChange={(e) => update({ callingStartTime: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="calling-end-time">Calling window end</Label>
          <Input
            id="calling-end-time"
            type="time"
            value={state.callingEndTime}
            onChange={(e) => update({ callingEndTime: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="start-date">Start date</Label>
          <Input
            id="start-date"
            type="date"
            value={state.startDate}
            onChange={(e) => update({ startDate: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="end-date">End date</Label>
          <Input
            id="end-date"
            type="date"
            value={state.endDate}
            onChange={(e) => update({ endDate: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="daily-call-limit">Daily call limit</Label>
          <Input
            id="daily-call-limit"
            type="number"
            min={1}
            value={state.dailyCallLimit}
            onChange={(e) => update({ dailyCallLimit: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="concurrency-limit">Concurrent calls</Label>
          <Input
            id="concurrency-limit"
            type="number"
            min={1}
            value={state.concurrencyLimit}
            onChange={(e) => update({ concurrencyLimit: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
    </div>
  );
}
