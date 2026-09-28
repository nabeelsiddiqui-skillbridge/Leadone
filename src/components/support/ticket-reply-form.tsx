"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function TicketReplyForm({
  onSubmit,
  placeholder = "Write a reply…",
}: {
  onSubmit: (message: string) => Promise<{ error?: string; message?: string }>;
  placeholder?: string;
}) {
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = textareaRef.current?.value.trim();
    if (!value) return;
    startTransition(async () => {
      const result = await onSubmit(value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (textareaRef.current) textareaRef.current.value = "";
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Textarea ref={textareaRef} rows={3} placeholder={placeholder} disabled={pending} />
      <Button type="submit" size="sm" disabled={pending} className="self-end">
        {pending ? "Sending…" : "Reply"}
      </Button>
    </form>
  );
}
