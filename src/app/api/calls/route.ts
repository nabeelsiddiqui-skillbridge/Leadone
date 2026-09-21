import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCurrentWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTwilioClientForWorkspace } from "@/lib/twilio";

export const runtime = "nodejs";

const initiateCallSchema = z.object({
  agentId: z.string().uuid(),
  contactId: z.string().uuid(),
  phoneNumberId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
});

/**
 * Places a real outbound call: creates the `calls` row, then asks Twilio to
 * dial out with the voice webhook pointed back at this app (which returns
 * TwiML connecting the call to the realtime voice server). Used today by
 * "Test Call" (agent testing) and any manual "Call now" action. The
 * campaign worker (Phase 4) will call this same endpoint once it exists —
 * it isn't built yet, so this only accepts an authenticated user session
 * for now.
 */
export async function POST(request: Request) {
  const { workspace } = await requireCurrentWorkspace();
  const supabase = await createClient();

  const body = await request.json().catch(() => null);
  const parsed = initiateCallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { agentId, contactId, phoneNumberId, campaignId } = parsed.data;

  const { data: agent } = await supabase
    .from("agents")
    .select("id, status")
    .eq("id", agentId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, phone, status")
    .eq("id", contactId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  if (contact.status === "do_not_call") {
    return NextResponse.json({ error: "This contact is on the Do Not Call list." }, { status: 409 });
  }

  const { data: dncEntry } = await supabase
    .from("do_not_call")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("phone", contact.phone)
    .maybeSingle();
  if (dncEntry) {
    return NextResponse.json({ error: "This phone number is on the Do Not Call list." }, { status: 409 });
  }

  let phoneNumberQuery = supabase
    .from("phone_numbers")
    .select("id, phone_number, status")
    .eq("workspace_id", workspace.id);
  phoneNumberQuery = phoneNumberId
    ? phoneNumberQuery.eq("id", phoneNumberId)
    : phoneNumberQuery.eq("is_default", true);
  const { data: phoneNumber } = await phoneNumberQuery.maybeSingle();

  if (!phoneNumber || phoneNumber.status !== "active") {
    return NextResponse.json({ error: "No active phone number available to call from." }, { status: 422 });
  }

  const twilio = await getTwilioClientForWorkspace(workspace.id);
  if (!twilio) {
    return NextResponse.json({ error: "Twilio isn't configured for this workspace yet." }, { status: 422 });
  }

  const { data: call, error: insertError } = await supabase
    .from("calls")
    .insert({
      workspace_id: workspace.id,
      campaign_id: campaignId ?? null,
      agent_id: agentId,
      contact_id: contactId,
      phone_number_id: phoneNumber.id,
      direction: "outbound",
      status: "queued",
    })
    .select("id")
    .single();

  if (insertError || !call) {
    return NextResponse.json({ error: insertError?.message ?? "Failed to create call record." }, { status: 500 });
  }

  const baseUrl = process.env.TWILIO_WEBHOOK_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  try {
    const twilioCall = await twilio.client.calls.create({
      to: contact.phone,
      from: phoneNumber.phone_number,
      url: `${baseUrl}/api/webhooks/twilio/voice?callId=${call.id}`,
      statusCallback: `${baseUrl}/api/webhooks/twilio/status?callId=${call.id}`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      record: true,
      recordingStatusCallback: `${baseUrl}/api/webhooks/twilio/recording?callId=${call.id}`,
      machineDetection: "DetectMessageEnd",
    });

    await supabase.from("calls").update({ twilio_call_sid: twilioCall.sid, status: "initiated" }).eq("id", call.id);

    return NextResponse.json({ callId: call.id, twilioCallSid: twilioCall.sid });
  } catch (err) {
    await supabase
      .from("calls")
      .update({ status: "failed", error_message: (err as Error).message })
      .eq("id", call.id);
    return NextResponse.json({ error: `Twilio call failed: ${(err as Error).message}` }, { status: 502 });
  }
}
