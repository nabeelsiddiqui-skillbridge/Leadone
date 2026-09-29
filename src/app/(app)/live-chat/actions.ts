"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser, requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
}

export async function takeOverConversationAction(conversationId: string): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("chat_conversations")
    .update({ status: "human", assigned_user_id: user?.id ?? null })
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/live-chat");
  revalidatePath(`/live-chat/${conversationId}`);
  return {};
}

export async function handBackToAiAction(conversationId: string): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("chat_conversations")
    .update({ status: "ai", assigned_user_id: null })
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/live-chat");
  revalidatePath(`/live-chat/${conversationId}`);
  return {};
}

export async function closeConversationAction(conversationId: string): Promise<ActionState> {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("chat_conversations")
    .update({ status: "closed" })
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/live-chat");
  revalidatePath(`/live-chat/${conversationId}`);
  return {};
}

/** Replying as a human implicitly takes the conversation over from the AI, if it wasn't already. */
export async function sendHumanReplyAction(conversationId: string, message: string): Promise<ActionState> {
  const trimmed = message.trim();
  if (!trimmed) return { error: "Message cannot be empty." };

  const { workspace } = await requireCurrentWorkspace();
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("id, status")
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!conversation) return { error: "Conversation not found." };

  const { error: insertError } = await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    workspace_id: workspace.id,
    sender_type: "human",
    sender_user_id: user?.id ?? null,
    message: trimmed,
  });

  if (insertError) return { error: insertError.message };

  await supabase
    .from("chat_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      status: "human",
      assigned_user_id: user?.id ?? null,
    })
    .eq("id", conversationId);

  revalidatePath("/live-chat");
  revalidatePath(`/live-chat/${conversationId}`);
  return {};
}
