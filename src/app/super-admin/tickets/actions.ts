"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TicketStatus } from "@/lib/supabase/database.types";

export interface AdminActionResult {
  error?: string;
  message?: string;
}

/**
 * Replies as the platform, through the normal RLS-scoped client -
 * is_workspace_member() already ORs in a super_admin bypass, so this works
 * across every workspace's tickets without needing the service-role client.
 */
export async function replyToTicketAsAdminAction(ticketId: string, message: string): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const supabase = await createClient();

  if (!message.trim()) return { error: "Message can't be empty." };

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id, workspace_id")
    .eq("id", ticketId)
    .single();

  if (ticketError || !ticket) return { error: "Ticket not found." };

  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    workspace_id: ticket.workspace_id,
    author_id: admin.id,
    is_from_admin: true,
    message: message.trim(),
  });

  if (error) return { error: error.message };

  await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", ticketId).eq("status", "open");

  revalidatePath(`/super-admin/tickets/${ticketId}`);
  revalidatePath("/super-admin/tickets");
  return { message: "Reply sent." };
}

export async function updateTicketStatusAction(ticketId: string, status: TicketStatus): Promise<AdminActionResult> {
  const { user: admin } = await requireSuperAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    action: "ticket.status_change",
    target_type: "support_ticket",
    target_id: ticketId,
    metadata: { status },
  });

  revalidatePath(`/super-admin/tickets/${ticketId}`);
  revalidatePath("/super-admin/tickets");
  return { message: "Status updated." };
}
