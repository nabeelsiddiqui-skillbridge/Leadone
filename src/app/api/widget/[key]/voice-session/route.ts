import { NextResponse } from "next/server";

import { getActiveWidgetByKey } from "@/lib/widget-lookup";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Visitor starts an in-browser voice chat. The realtime-voice server is
 * already transport/direction-agnostic (see the inbound-calling webhook's
 * own comment on this) - it only needs a `calls` row to read the agent from
 * and a WebSocket that speaks its "start"/"media"/"stop" JSON protocol, the
 * exact shape Twilio's Media Streams use. So this route does the one thing
 * that's actually new - create that row, with no phone number involved
 * (channel: "web_widget", contact_id left null) - and the browser then
 * connects directly to the same /media-stream endpoint Twilio calls use,
 * speaking the same protocol. No realtime-voice server changes needed.
 */
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;

  const rateLimit = checkRateLimit(`widget-voice-session:${key}`, 10, 60);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 });
  }

  const { supabase, widget } = await getActiveWidgetByKey(key);
  if (!widget) return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  if (!widget.voice_chat_enabled) {
    return NextResponse.json({ error: "Voice chat isn't enabled for this widget." }, { status: 422 });
  }
  if (!widget.agent_id) {
    return NextResponse.json({ error: "This widget has no agent configured." }, { status: 422 });
  }

  const { data: call, error } = await supabase
    .from("calls")
    .insert({
      workspace_id: widget.workspace_id,
      agent_id: widget.agent_id,
      channel: "web_widget",
      direction: "inbound",
      status: "ringing",
    })
    .select("id")
    .single();

  if (error || !call) {
    return NextResponse.json({ error: error?.message ?? "Failed to start voice session." }, { status: 500 });
  }

  const wsUrl = process.env.REALTIME_WEBSOCKET_URL ?? "ws://localhost:8080/media-stream";

  return NextResponse.json({ callId: call.id, wsUrl });
}
