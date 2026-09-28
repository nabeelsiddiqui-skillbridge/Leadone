"use client";

import { cn } from "@/lib/utils";
import { replyToTicketAction } from "@/app/(app)/support/actions";
import { replyToTicketAsAdminAction } from "@/app/super-admin/tickets/actions";
import { TicketReplyForm } from "@/components/support/ticket-reply-form";

export interface TicketMessage {
  id: string;
  message: string;
  isFromAdmin: boolean;
  createdAt: string;
  authorName: string | null;
}

export function TicketThread({
  ticketId,
  messages,
  asAdmin,
}: {
  ticketId: string;
  messages: TicketMessage[];
  asAdmin: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-2xl rounded-lg border px-4 py-3 text-sm",
                m.isFromAdmin ? "self-start bg-muted" : "self-end bg-primary/5"
              )}
            >
              <p className="whitespace-pre-wrap">{m.message}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {m.isFromAdmin ? "LeadOne Support" : (m.authorName ?? "You")} ·{" "}
                {new Date(m.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>

      <TicketReplyForm
        placeholder={asAdmin ? "Reply as support…" : "Write a reply…"}
        onSubmit={(message) =>
          asAdmin ? replyToTicketAsAdminAction(ticketId, message) : replyToTicketAction(ticketId, message)
        }
      />
    </div>
  );
}
