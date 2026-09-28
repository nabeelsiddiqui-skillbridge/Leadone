"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateTicketStatusAction } from "@/app/super-admin/tickets/actions";
import type { TicketStatus } from "@/lib/supabase/database.types";

const STATUSES: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

export function TicketStatusSelect({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    startTransition(async () => {
      const result = await updateTicketStatusAction(ticketId, next as TicketStatus);
      if (result.error) toast.error(result.error);
      else toast.success(result.message ?? "Status updated.");
    });
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s.replace("_", " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
