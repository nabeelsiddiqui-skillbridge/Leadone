import { NextResponse } from "next/server";

import { getActiveWidgetByKey } from "@/lib/widget-lookup";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Public, unauthenticated: the embed script/iframe reads this to render the bubble + chat window. */
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;

  const rateLimit = checkRateLimit(`widget-config:${key}`, 120, 60);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { widget } = await getActiveWidgetByKey(key);
  if (!widget) {
    return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: widget.id,
    name: widget.name,
    primaryColor: widget.primary_color,
    size: widget.size,
    greetingMessage: widget.greeting_message,
    chatEnabled: widget.chat_enabled,
    voiceChatEnabled: widget.voice_chat_enabled,
  });
}
