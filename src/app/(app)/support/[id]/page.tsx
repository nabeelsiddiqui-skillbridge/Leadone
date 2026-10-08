import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { TicketThread } from "@/components/support/ticket-thread";

export const metadata: Metadata = { title: "Support | Ticket" };

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id, subject, status, priority, created_at")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (ticketError) throw new Error(`Failed to load ticket: ${ticketError.message}`);
  if (!ticket) notFound();

  const { data: messages } = await supabase
    .from("support_ticket_messages")
    .select("id, message, is_from_admin, created_at, author:profiles(full_name)")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/support"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to support
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
          <Badge variant={ticket.status === "resolved" || ticket.status === "closed" ? "success" : "warning"}>
            {ticket.status.replace("_", " ")}
          </Badge>
        </div>
      </div>

      <TicketThread
        ticketId={ticket.id}
        messages={(messages ?? []).map((m) => ({
          id: m.id,
          message: m.message,
          isFromAdmin: m.is_from_admin,
          createdAt: m.created_at,
          authorName: (m.author as unknown as { full_name: string | null } | null)?.full_name ?? null,
        }))}
        asAdmin={false}
      />
    </div>
  );
}
