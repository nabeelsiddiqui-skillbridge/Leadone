import { NextResponse } from "next/server";
import { z } from "zod";

import { getActiveWidgetByKey } from "@/lib/widget-lookup";
import { generateChatReply } from "@/lib/chat-ai";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

async function loadConversation(
  supabase: Awaited<ReturnType<typeof getActiveWidgetByKey>>["supabase"],
  widgetId: string,
  conversationId: string
) {
  const { data } = await supabase
    .from("chat_conversations")
    .select("id, status, widget_id")
    .eq("id", conversationId)
    .eq("widget_id", widgetId)
    .maybeSingle();
  return data;
}

/** Polling endpoint: the widget calls this every few seconds while open to pick up human replies. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string; conversationId: string }> }
) {
  const { key, conversationId } = await params;
  const { searchParams } = new URL(request.url);
  const after = searchParams.get("after");

  const { supabase, widget } = await getActiveWidgetByKey(key);
  if (!widget) return NextResponse.json({ error: "Widget not found." }, { status: 404 });

  const conversation = await loadConversation(supabase, widget.id, conversationId);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  let query = supabase
    .from("chat_messages")
    .select("id, sender_type, message, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (after) query = query.gt("created_at", after);

  const { data: messages } = await query;
  return NextResponse.json({ messages: messages ?? [] });
}

const sendMessageSchema = z.object({ message: z.string().min(1).max(4000) });

/** Visitor sends a message. Triggers an AI reply immediately unless a human already took the conversation over. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string; conversationId: string }> }
) {
  const { key, conversationId } = await params;

  const rateLimit = checkRateLimit(`widget-message:${conversationId}`, 30, 60);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many messages. Slow down a little." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { supabase, widget } = await getActiveWidgetByKey(key);
  if (!widget) return NextResponse.json({ error: "Widget not found." }, { status: 404 });

  const conversation = await loadConversation(supabase, widget.id, conversationId);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const { data: visitorMessage, error: insertError } = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      workspace_id: widget.workspace_id,
      sender_type: "visitor",
      message: parsed.data.message,
    })
    .select("id, sender_type, message, created_at")
    .single();

  if (insertError || !visitorMessage) {
    return NextResponse.json({ error: insertError?.message ?? "Failed to send message." }, { status: 500 });
  }

  // A conversation a visitor messages into again after it was closed is
  // effectively a new inbound conversation - hand it back to the AI rather
  // than leaving it silently dead.
  const nextStatus = conversation.status === "closed" ? "ai" : conversation.status;
  await supabase
    .from("chat_conversations")
    .update({ last_message_at: new Date().toISOString(), status: nextStatus })
    .eq("id", conversationId);

  const newMessages = [visitorMessage];

  if (nextStatus === "ai") {
    const { data: history } = await supabase
      .from("chat_messages")
      .select("sender_type, message")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    const reply = await generateChatReply(supabase, {
      workspaceId: widget.workspace_id,
      agentId: widget.agent_id,
      greeting: widget.greeting_message,
      history: history ?? [],
    });

    const { data: assistantMessage } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        workspace_id: widget.workspace_id,
        sender_type: "assistant",
        message: reply,
      })
      .select("id, sender_type, message, created_at")
      .single();

    if (assistantMessage) {
      newMessages.push(assistantMessage);
      await supabase
        .from("chat_conversations")
        .update({ last_message_at: assistantMessage.created_at })
        .eq("id", conversationId);
    }
  }

  return NextResponse.json({ messages: newMessages });
}
