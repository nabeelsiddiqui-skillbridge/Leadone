"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateWidgetAction } from "@/app/(app)/widgets/actions";
import { WidgetFormFields } from "@/components/widgets/widget-form-fields";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Database } from "@/lib/supabase/database.types";

type ChatWidgetRow = Database["public"]["Tables"]["chat_widgets"]["Row"];

export function EditWidgetForm({
  widget,
  agents,
}: {
  widget: ChatWidgetRow;
  agents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateWidgetAction(widget.id, {}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Widget saved.");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="grid gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <WidgetFormFields
        agents={agents}
        defaults={{
          name: widget.name,
          agentId: widget.agent_id,
          mode: widget.mode,
          size: widget.size,
          primaryColor: widget.primary_color,
          greetingMessage: widget.greeting_message,
        }}
      />
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
