"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Phone, Mic, Send, X, Loader2, CheckCircle2 } from "lucide-react";

import type { WidgetMode, WidgetSize } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { VoiceChatPanel } from "@/components/widget/voice-chat-panel";

/** Lightens (positive percent) or darkens (negative) a hex color, for the gradient/glow treatment below. */
function shadeColor(hex: string, percent: number): string {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = Number.parseInt(normalized, 16);
  if (Number.isNaN(num)) return hex;
  const amount = Math.round(255 * (percent / 100));
  const clamp = (channel: number) => Math.max(0, Math.min(255, channel + amount));
  const r = clamp((num >> 16) & 0xff);
  const g = clamp((num >> 8) & 0xff);
  const b = clamp(num & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function gradientStyle(color: string) {
  return { backgroundImage: `linear-gradient(135deg, ${color}, ${shadeColor(color, -22)})` };
}

interface WidgetMessage {
  id: string;
  sender_type: "visitor" | "assistant" | "human";
  message: string;
  created_at: string;
}

interface WidgetChatProps {
  widgetKey: string;
  name: string;
  mode: WidgetMode;
  primaryColor: string;
  size: WidgetSize;
  greetingMessage: string;
  voiceChatEnabled?: boolean;
}

const SIZE_DIMENSIONS: Record<WidgetSize, { width: string; height: string }> = {
  compact: { width: "320px", height: "440px" },
  standard: { width: "380px", height: "580px" },
  large: { width: "420px", height: "680px" },
};

const VISITOR_ID_STORAGE_KEY = "leadone_widget_visitor_id";
const POLL_INTERVAL_MS = 3000;

function getOrCreateVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function mergeMessages(existing: WidgetMessage[], incoming: WidgetMessage[]): WidgetMessage[] {
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function WidgetChat({
  widgetKey,
  name,
  mode,
  primaryColor,
  size,
  greetingMessage,
  voiceChatEnabled = false,
}: WidgetChatProps) {
  const [open, setOpen] = useState(false);
  const chatEnabled = mode === "chat" || mode === "both";
  const callEnabled = mode === "call" || mode === "both";
  const [tab, setTab] = useState<"chat" | "call" | "voice">(
    chatEnabled ? "chat" : voiceChatEnabled ? "voice" : "call"
  );
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [callPhone, setCallPhone] = useState("");
  const [callName, setCallName] = useState("");
  const [callState, setCallState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [callError, setCallError] = useState<string | null>(null);

  const visitorIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dimensions = SIZE_DIMENSIONS[size] ?? SIZE_DIMENSIONS.standard;

  const startingConversation = open && chatEnabled && !conversationId;

  useEffect(() => {
    if (!startingConversation) return;
    if (!visitorIdRef.current) visitorIdRef.current = getOrCreateVisitorId();

    fetch(`/api/widget/${widgetKey}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId: visitorIdRef.current,
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.conversationId) setConversationId(data.conversationId);
        if (Array.isArray(data.messages)) setMessages(data.messages);
      })
      .catch(() => {});
  }, [startingConversation, widgetKey]);

  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(() => {
      const last = messages[messages.length - 1];
      const after = last ? last.created_at : "";
      fetch(`/api/widget/${widgetKey}/conversations/${conversationId}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages((prev) => mergeMessages(prev, data.messages));
          }
        })
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [conversationId, widgetKey, messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Tells the embed script (public/widget.js) how large to size the hosting
  // iframe: a small bubble when closed, the full chat window when open. The
  // iframe itself always fills its container, so the container is what
  // actually needs to grow/shrink on the host page.
  //
  // Closed: this page's p-4 padding (16px/side, 32 total) leaves an inner
  // area of 96-32=64 for the 56px bubble button - deliberately more than
  // 56 so there's real slack (not just an exact pixel-for-pixel fit) for
  // the ring/shadow around the button and for browser rounding. Keep this
  // 96 in sync with BUBBLE_SIZE in public/widget.js.
  // Open: dimensions + 32 matches the same p-4 padding around the panel.
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    const width = open ? Number.parseInt(dimensions.width, 10) + 32 : 96;
    const height = open ? Number.parseInt(dimensions.height, 10) + 32 : 96;
    window.parent.postMessage({ source: "leadone-widget", open, width, height }, "*");
  }, [open, dimensions.width, dimensions.height]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !conversationId || sending) return;

    setDraft("");
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { id: `optimistic-${Date.now()}`, sender_type: "visitor", message: text, created_at: new Date().toISOString() },
    ]);

    try {
      const res = await fetch(`/api/widget/${widgetKey}/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setMessages((prev) => mergeMessages(prev.filter((m) => !m.id.startsWith("optimistic-")), data.messages));
      }
    } catch {
      // Optimistic message stays visible; the next poll will reconcile once connectivity returns.
    } finally {
      setSending(false);
    }
  }

  async function handleCallRequest(event: FormEvent) {
    event.preventDefault();
    setCallState("submitting");
    setCallError(null);
    try {
      const res = await fetch(`/api/widget/${widgetKey}/call-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: callPhone.trim(), name: callName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCallState("error");
        setCallError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setCallState("success");
    } catch {
      setCallState("error");
      setCallError("Something went wrong. Please try again.");
    }
  }

  if (!open) {
    const bubbleLabel = chatEnabled
      ? `Chat with ${name}`
      : voiceChatEnabled
        ? `Talk to ${name}`
        : `Call ${name}`;
    const BubbleIcon = chatEnabled ? MessageCircle : voiceChatEnabled ? Mic : Phone;
    return (
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span
          className="absolute h-14 w-14 animate-ping rounded-full opacity-30"
          style={{ backgroundColor: primaryColor }}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={bubbleLabel}
          className="relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_10px_28px_-6px_rgba(0,0,0,0.4)] ring-4 ring-white transition-transform hover:scale-105 active:scale-95"
          style={gradientStyle(primaryColor)}
        >
          <BubbleIcon className="h-6 w-6" />
          {mode === "both" && (
            <span
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white"
              style={{ color: primaryColor }}
            >
              <Phone className="h-2.5 w-2.5" strokeWidth={2.5} />
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-2xl"
      style={{ width: dimensions.width, height: dimensions.height, maxWidth: "calc(100vw - 24px)", maxHeight: "calc(100vh - 24px)" }}
    >
      <div className="flex items-center justify-between px-4 py-3.5 text-white" style={gradientStyle(primaryColor)}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold ring-2 ring-white/30">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">{name}</p>
            <p className="flex items-center gap-1.5 text-xs text-white/80">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
              </span>
              Online now
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1.5 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      {(() => {
        const tabs: { key: "chat" | "voice" | "call"; label: string }[] = [
          ...(chatEnabled ? [{ key: "chat" as const, label: "Chat" }] : []),
          ...(voiceChatEnabled ? [{ key: "voice" as const, label: "Voice" }] : []),
          ...(callEnabled ? [{ key: "call" as const, label: "Request a call" }] : []),
        ];
        if (tabs.length < 2) return null;
        return (
          <div className="flex border-b border-gray-100 bg-gray-50 text-sm">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 py-2 font-medium transition-colors",
                  tab === t.key ? "border-b-2 text-gray-900" : "text-gray-400 hover:text-gray-600"
                )}
                style={tab === t.key ? { borderColor: primaryColor } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
        );
      })()}

      {tab === "voice" && voiceChatEnabled && (
        <VoiceChatPanel widgetKey={widgetKey} name={name} primaryColor={primaryColor} active={open && tab === "voice"} />
      )}

      {tab === "chat" && chatEnabled ? (
        <>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4">
            {startingConversation && messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-gray-400">{greetingMessage}</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn("flex", m.sender_type === "visitor" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                      m.sender_type === "visitor" ? "text-white" : "bg-white text-gray-800"
                    )}
                    style={m.sender_type === "visitor" ? gradientStyle(primaryColor) : undefined}
                  >
                    {m.message}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300" />
                </div>
              </div>
            )}
          </div>
          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-gray-100 bg-white p-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-gray-300"
              disabled={!conversationId}
            />
            <button
              type="submit"
              disabled={!draft.trim() || !conversationId || sending}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-transform disabled:opacity-40 disabled:hover:scale-100 hover:scale-105"
              style={gradientStyle(primaryColor)}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      ) : tab === "call" && callEnabled ? (
        <div className="flex flex-1 flex-col justify-center gap-4 bg-gray-50 px-5 py-6">
          {callState === "success" ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="h-9 w-9" style={{ color: primaryColor }} />
              <p className="text-sm font-medium text-gray-900">We&apos;re calling you now</p>
              <p className="text-xs text-gray-500">Keep an eye on your phone — it&apos;ll ring in just a moment.</p>
            </div>
          ) : (
            <form onSubmit={handleCallRequest} className="flex flex-col gap-3">
              <div className="flex flex-col items-center gap-2 pb-1 text-center">
                <Phone className="h-7 w-7" style={{ color: primaryColor }} />
                <p className="text-sm font-medium text-gray-900">Talk to us right now</p>
                <p className="text-xs text-gray-500">Leave your number and we&apos;ll call you immediately.</p>
              </div>
              <input
                value={callName}
                onChange={(e) => setCallName(e.target.value)}
                placeholder="Your name (optional)"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-300"
              />
              <input
                value={callPhone}
                onChange={(e) => setCallPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                type="tel"
                required
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-300"
              />
              {callError && <p className="text-xs text-red-500">{callError}</p>}
              <button
                type="submit"
                disabled={callState === "submitting" || !callPhone.trim()}
                className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white shadow-sm transition-transform disabled:opacity-50 disabled:hover:scale-100 hover:scale-[1.02]"
                style={gradientStyle(primaryColor)}
              >
                {callState === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                Call me now
              </button>
            </form>
          )}
        </div>
      ) : null}

      <div className="border-t border-gray-100 bg-white px-4 py-1.5 text-center text-[10px] text-gray-300">
        Powered by LeadOne
      </div>
    </div>
  );
}
