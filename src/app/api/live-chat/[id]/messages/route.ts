import { NextResponse } from "next/server";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Authenticated polling endpoint backing the Live Chat thread view — picks up new visitor/AI/human messages. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const after = searchParams.get("after");

  let query = supabase
    .from("chat_messages")
    .select("id, sender_type, message, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (after) query = query.gt("created_at", after);

  const { data: messages } = await query;
  return NextResponse.json({ messages: messages ?? [] });
}
