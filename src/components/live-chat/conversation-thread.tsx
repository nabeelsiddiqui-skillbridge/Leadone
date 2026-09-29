"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send, User, UserCog } from "lucide-react";
import { toast } from "sonner";

import {
  handBackToAiAction,
  sendHumanReplyAction,
  takeOverConversationAction,
} from "@/app/(app)/live-chat/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatConversationStatus, ChatSenderType } from "@/lib/supabase/database.types";

interface ThreadMessage {
  id: string;
  sender_type: ChatSenderType;
  message: string;
  created_at: string;
}

const POLL_INTERVAL_MS = 4000;

function mergeMessages(existing: ThreadMessage[], incoming: ThreadMessage[]): ThreadMessage[] {
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function ConversationThread({
  conversationId,
  visitorName,
  visitorPhone,
  pageUrl,
  widgetName,
  status,
  initialMessages,
}: {
  conversationId: string;
  visitorName: string;
  visitorPhone: string | null;
  pageUrl: string | null;
  widgetName: string;
  status: ChatConversationStatus;
  initialMessages: ThreadMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [togglePending, setTogglePending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const last = messages[messages.length - 1];
      const url = `/api/live-chat/${conversationId}/messages${last ? `?after=${encodeURIComponent(last.created_at)}` : ""}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages((prev) => mergeMessages(prev, data.messages));
        }
      } catch {
        // Best-effort polling — a failed tick just gets retried on the next interval.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [conversationId, messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setSending(true);
    const result = await sendHumanReplyAction(conversationId, text);
    setSending(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setMessages((prev) => [
      ...prev,
      { id: `optimistic-${Date.now()}`, sender_type: "human", message: text, created_at: new Date().toISOString() },
    ]);
    router.refresh();
  }

  async function handleTakeOver() {
    setTogglePending(true);
    const result = await takeOverConversationAction(conversationId);
    setTogglePending(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success("You're now handling this conversation.");
      router.refresh();
    }
  }

  async function handleHandBack() {
    setTogglePending(true);
    const result = await handBackToAiAction(conversationId);
    setTogglePending(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Handed back to the AI.");
      router.refresh();
    }
  }

  return (
    <Card className="flex flex-1 flex-col overflow-hidden p-0">
      <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
        <div>
          <h1 className="text-base font-semibold text-foreground">{visitorName}</h1>
          <p className="text-xs text-muted-foreground">
            {widgetName}
            {visitorPhone ? ` · ${visitorPhone}` : ""}
            {pageUrl ? ` · ${new URL(pageUrl).pathname}` : ""}
          </p>
        </div>
        {status === "human" ? (
          <Button size="sm" variant="outline" onClick={handleHandBack} disabled={togglePending}>
            <Bot /> Hand back to AI
          </Button>
        ) : (
          <Button size="sm" onClick={handleTakeOver} disabled={togglePending}>
            <UserCog /> Take over
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 px-5 py-4">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.sender_type === "visitor" ? "justify-start" : "justify-end")}>
            <div className={cn("flex max-w-[75%] flex-col gap-0.5", m.sender_type === "visitor" ? "items-start" : "items-end")}>
              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                  m.sender_type === "visitor" ? "bg-card text-foreground" : "bg-primary text-primary-foreground"
                )}
              >
                {m.message}
              </div>
              {m.sender_type !== "visitor" && (
                <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                  {m.sender_type === "assistant" ? <Bot className="size-2.5" /> : <User className="size-2.5" />}
                  {m.sender_type === "assistant" ? "AI" : "You"}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t bg-card p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={status === "ai" ? "Reply to take over from the AI…" : "Reply as yourself…"}
          className="flex-1 rounded-full border bg-background px-4 py-2 text-sm outline-none focus:border-ring"
        />
        <Button type="submit" size="icon" disabled={!draft.trim() || sending} className="shrink-0 rounded-full">
          <Send className="size-4" />
        </Button>
      </form>
    </Card>
  );
}
