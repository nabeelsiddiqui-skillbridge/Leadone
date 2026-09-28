"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentWorkspace, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  message?: string;
}

export async function createTicketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!subject) return { error: "Subject is required." };
  if (!message) return { error: "Describe your issue." };

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({ workspace_id: workspace.id, created_by: user.id, subject })
    .select("id")
    .single();

  if (error || !ticket) return { error: error?.message ?? "Failed to create ticket." };

  const { error: messageError } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticket.id,
    workspace_id: workspace.id,
    author_id: user.id,
    is_from_admin: false,
    message,
  });

  if (messageError) return { error: messageError.message };

  revalidatePath("/support");
  redirect(`/support/${ticket.id}`);
}

export async function replyToTicketAction(ticketId: string, message: string): Promise<ActionState> {
  const user = await requireUser();
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  if (!message.trim()) return { error: "Message can't be empty." };

  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    workspace_id: workspace.id,
    author_id: user.id,
    is_from_admin: false,
    message: message.trim(),
  });

  if (error) return { error: error.message };

  await supabase
    .from("support_tickets")
    .update({ status: "open" })
    .eq("id", ticketId)
    .eq("workspace_id", workspace.id)
    .in("status", ["resolved", "closed"]);

  revalidatePath(`/support/${ticketId}`);
  return { message: "Reply sent." };
}
