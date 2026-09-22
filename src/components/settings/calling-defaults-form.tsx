"use client";

import { useActionState } from "react";

import { updateCallingDefaultsAction, type ActionState, type CallingDefaults } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";

const initialState: ActionState = {};

export function CallingDefaultsForm({ defaults }: { defaults: CallingDefaults }) {
  const [state, formAction, pending] = useActionState(updateCallingDefaultsAction, initialState);

  return (
    <form action={formAction} className="grid max-w-md gap-4">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.message && (
        <Alert variant="success">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <p className="text-sm text-muted-foreground">
        These are workspace-wide defaults. Individual campaigns can still set their own calling hours and
        concurrency in the campaign wizard.
      </p>
      <div className="grid gap-2">
        <Label htmlFor="default_timezone">Default timezone</Label>
        <Input
          id="default_timezone"
          name="default_timezone"
          placeholder="America/New_York"
          defaultValue={defaults.default_timezone ?? "UTC"}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="calling_hours_start">Calling hours start</Label>
          <Input
            id="calling_hours_start"
            name="calling_hours_start"
            type="time"
            defaultValue={defaults.calling_hours_start ?? "09:00"}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="calling_hours_end">Calling hours end</Label>
          <Input
            id="calling_hours_end"
            name="calling_hours_end"
            type="time"
            defaultValue={defaults.calling_hours_end ?? "17:00"}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="max_concurrent_calls">Max concurrent calls</Label>
        <Input
          id="max_concurrent_calls"
          name="max_concurrent_calls"
          type="number"
          min={1}
          max={50}
          defaultValue={defaults.max_concurrent_calls ?? 3}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch id="recording_enabled" name="recording_enabled" defaultChecked={defaults.recording_enabled ?? true} />
        <Label htmlFor="recording_enabled">Record calls by default</Label>
      </div>
      <Button type="submit" size="sm" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : "Save calling defaults"}
      </Button>
    </form>
  );
}
