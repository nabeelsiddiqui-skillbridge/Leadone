import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireSuperAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { TicketThread } from "@/components/support/ticket-thread";
import { TicketStatusSelect } from "@/components/super-admin/ticket-status-select";
import type { TicketStatus } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Super Admin | Ticket" };

export default async function SuperAdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSuperAdmin();
  const db = createServiceRoleClient();

  const { data: ticket } = await db
    .from("support_tickets")
    .select("id, subject, status, priority, created_at, workspace:workspaces(id, name)")
    .eq("id", id)
    .single();

  if (!ticket) notFound();
  const workspace = ticket.workspace as unknown as { id: string; name: string } | null;

  const { data: messages } = await db
    .from("support_ticket_messages")
    .select("id, message, is_from_admin, created_at, author:profiles(full_name)")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/super-admin/tickets"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to tickets
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
            <p className="text-sm text-muted-foreground">{workspace?.name ?? "Unknown workspace"}</p>
          </div>
          <TicketStatusSelect ticketId={ticket.id} status={ticket.status as TicketStatus} />
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
        asAdmin
      />
    </div>
  );
}
