import { NextResponse } from "next/server";
import { z } from "zod";

import { getActiveWidgetByKey } from "@/lib/widget-lookup";
import { placeCall } from "@/lib/place-call";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const callRequestSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{6,14}$/, "Enter a valid phone number, including country code."),
  name: z.string().max(200).optional(),
});

/**
 * Visitor asks to be called back right now. Implemented on top of the same
 * proven Twilio outbound pipeline every other call in the app uses
 * (src/lib/place-call.ts) — the widget places a real phone call to the
 * visitor's number rather than opening an in-browser WebRTC voice session.
 */
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;

  const rateLimit = checkRateLimit(`widget-call-request:${key}`, 5, 60);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many call requests. Please wait a minute and try again." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = callRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const { supabase, widget } = await getActiveWidgetByKey(key);
  if (!widget) return NextResponse.json({ error: "Widget not found." }, { status: 404 });
  if (widget.mode !== "call" && widget.mode !== "both") {
    return NextResponse.json({ error: "Call requests aren't enabled for this widget." }, { status: 422 });
  }
  if (!widget.agent_id) {
    return NextResponse.json({ error: "This widget has no agent configured to take the call." }, { status: 422 });
  }

  const phone = parsed.data.phone.startsWith("+") ? parsed.data.phone : `+${parsed.data.phone}`;

  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id, status")
    .eq("workspace_id", widget.workspace_id)
    .eq("phone", phone)
    .maybeSingle();

  let contactId = existingContact?.id ?? null;
  if (!contactId) {
    const { data: newContact, error: contactError } = await supabase
      .from("contacts")
      .insert({
        workspace_id: widget.workspace_id,
        phone,
        first_name: parsed.data.name ?? null,
        status: "new",
      })
      .select("id")
      .single();

    if (contactError || !newContact) {
      return NextResponse.json({ error: contactError?.message ?? "Failed to save contact." }, { status: 500 });
    }
    contactId = newContact.id;
  }

  const result = await placeCall(supabase, {
    workspaceId: widget.workspace_id,
    agentId: widget.agent_id,
    contactId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ callId: result.callId });
}
