import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { Bot, User, CircleCheck } from "lucide-react";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatConversationStatus } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Live Chat" };

const STATUS_META: Record<ChatConversationStatus, { label: string; icon: typeof Bot; className: string }> = {
  ai: { label: "AI handling", icon: Bot, className: "bg-chart-2/15 text-chart-2" },
  human: { label: "You're handling", icon: User, className: "bg-primary/15 text-primary" },
  closed: { label: "Closed", icon: CircleCheck, className: "bg-muted text-muted-foreground" },
};

export default async function LiveChatPage() {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("chat_conversations")
    .select("id, visitor_name, visitor_email, status, last_message_at, created_at, widget:chat_widgets(name)")
    .eq("workspace_id", workspace.id)
    .order("last_message_at", { ascending: false })
    .limit(100);

  const conversationIds = (conversations ?? []).map((c) => c.id);
  const lastMessageByConversation = new Map<string, { message: string; sender_type: string }>();

  if (conversationIds.length > 0) {
    const { data: recentMessages } = await supabase
      .from("chat_messages")
      .select("conversation_id, message, sender_type, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

    for (const m of recentMessages ?? []) {
      if (!lastMessageByConversation.has(m.conversation_id)) {
        lastMessageByConversation.set(m.conversation_id, { message: m.message, sender_type: m.sender_type });
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Live Chat"
        description="Every conversation from your embedded widgets. The AI answers by default — take over any time and reply yourself."
      />

      {!conversations || conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Once your widget is embedded and visitors start chatting, conversations will show up here."
          actionHref="/widgets"
          actionLabel="Set up a widget"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <ul className="divide-y">
            {conversations.map((c) => {
              const meta = STATUS_META[c.status] ?? STATUS_META.closed;
              const Icon = meta.icon;
              const preview = lastMessageByConversation.get(c.id);
              const widget = c.widget as unknown as { name: string } | null;
              return (
                <li key={c.id}>
                  <Link
                    href={`/live-chat/${c.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {c.visitor_name || c.visitor_email || "Website visitor"}
                        </span>
                        <span className="text-xs text-muted-foreground">· {widget?.name ?? "Widget"}</span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {preview ? preview.message : "No messages yet"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge className={cn("border-transparent", meta.className)}>
                        <Icon className="size-3" /> {meta.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(c.last_message_at), { addSuffix: true })}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
