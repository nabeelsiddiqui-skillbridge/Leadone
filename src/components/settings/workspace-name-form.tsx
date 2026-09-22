"use client";

import { useActionState } from "react";

import { updateWorkspaceNameAction, type ActionState } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const initialState: ActionState = {};

export function WorkspaceNameForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(updateWorkspaceNameAction, initialState);

  return (
    <form action={formAction} className="grid max-w-sm gap-3">
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
      <div className="grid gap-2">
        <Label htmlFor="name">Workspace name</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <Button type="submit" size="sm" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
