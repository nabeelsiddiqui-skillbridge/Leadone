import { NextResponse } from "next/server";
import { z } from "zod";

import { getActiveWidgetByKey } from "@/lib/widget-lookup";
import { generateChatReply } from "@/lib/chat-ai";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const startConversationSchema = z.object({
  visitorId: z.string().min(1).max(200),
  visitorName: z.string().max(200).optional(),
  visitorEmail: z.string().email().max(320).optional(),
  pageUrl: z.string().max(2000).optional(),
});

/**
 * Get-or-create: the widget calls this once on open with a visitorId it
 * generates and persists itself (localStorage), so returning visitors land
 * back in the same open conversation instead of starting a new one every
 * page load. Seeds the AI greeting as the first message on brand-new
 * conversations only.
 */
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;

  const rateLimit = checkRateLimit(`widget-conversations:${key}`, 30, 60);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = startConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { supabase, widget } = await getActiveWidgetByKey(key);
  if (!widget) {
    return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  }
  if (!widget.mode || (widget.mode !== "chat" && widget.mode !== "both")) {
    return NextResponse.json({ error: "Chat isn't enabled for this widget." }, { status: 422 });
  }

  const { data: existing } = await supabase
    .from("chat_conversations")
    .select("id, status")
    .eq("widget_id", widget.id)
    .eq("visitor_id", parsed.data.visitorId)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId = existing?.id ?? null;

  if (!conversationId) {
    const { data: conversation, error: insertError } = await supabase
      .from("chat_conversations")
      .insert({
        workspace_id: widget.workspace_id,
        widget_id: widget.id,
        visitor_id: parsed.data.visitorId,
        visitor_name: parsed.data.visitorName ?? null,
        visitor_email: parsed.data.visitorEmail ?? null,
        page_url: parsed.data.pageUrl ?? null,
        status: "ai",
      })
      .select("id")
      .single();

    if (insertError || !conversation) {
      return NextResponse.json({ error: insertError?.message ?? "Failed to start conversation." }, { status: 500 });
    }
    conversationId = conversation.id;

    const greeting = await generateChatReply(supabase, {
      workspaceId: widget.workspace_id,
      agentId: widget.agent_id,
      greeting: widget.greeting_message,
      history: [],
    });

    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      workspace_id: widget.workspace_id,
      sender_type: "assistant",
      message: greeting,
    });
  }

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, sender_type, message, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ conversationId, messages: messages ?? [] });
}
