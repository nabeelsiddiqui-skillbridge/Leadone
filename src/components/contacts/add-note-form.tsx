"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { addContactNoteAction, type ContactActionState } from "@/app/(app)/contacts/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

const initialState: ContactActionState = {};

export function AddNoteForm({ contactId }: { contactId: string }) {
  const [state, formAction, pending] = useActionState(addContactNoteAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast.success("Note added.");
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-2">
      <input type="hidden" name="contact_id" value={contactId} />
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Textarea name="note" placeholder="Add a note about this contact…" required rows={3} />
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
