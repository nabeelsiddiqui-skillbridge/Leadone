import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ConversationThread } from "@/components/live-chat/conversation-thread";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("*, widget:chat_widgets(name, primary_color)")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!conversation) notFound();

  const widget = conversation.widget as unknown as { name: string; primary_color: string } | null;

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, sender_type, message, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-3xl flex-col gap-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
          <Link href="/live-chat">
            <ArrowLeft /> All conversations
          </Link>
        </Button>
      </div>
      <ConversationThread
        conversationId={conversation.id}
        visitorName={conversation.visitor_name || conversation.visitor_email || "Website visitor"}
        visitorPhone={conversation.visitor_phone}
        pageUrl={conversation.page_url}
        widgetName={widget?.name ?? "Widget"}
        status={conversation.status}
        initialMessages={messages ?? []}
      />
    </div>
  );
}
