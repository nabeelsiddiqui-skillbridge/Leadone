import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { getTwilioClientForWorkspace } from "@/lib/twilio";

export interface PlaceCallInput {
  workspaceId: string;
  agentId: string;
  contactId: string;
  phoneNumberId?: string;
  campaignId?: string;
}

export type PlaceCallResult =
  | { ok: true; callId: string; twilioCallSid: string }
  | { ok: false; status: number; error: string };

/**
 * Shared call-placement logic used by both the authenticated-user path
 * (POST /api/calls with a session — manual/test calls) and the campaign
 * worker path (same route, service-role client + a shared-secret header —
 * see the worker-auth branch in route.ts). Enforces Do Not Call, an active
 * phone number, and Twilio configuration before ever dialing.
 */
export async function placeCall(
  supabase: SupabaseClient<Database>,
  input: PlaceCallInput
): Promise<PlaceCallResult> {
  const { workspaceId, agentId, contactId, phoneNumberId, campaignId } = input;

  const { data: agent } = await supabase
    .from("agents")
    .select("id, status")
    .eq("id", agentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!agent) return { ok: false, status: 404, error: "Agent not found." };

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, phone, status")
    .eq("id", contactId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!contact) return { ok: false, status: 404, error: "Contact not found." };
  if (contact.status === "do_not_call") {
    return { ok: false, status: 409, error: "This contact is on the Do Not Call list." };
  }

  const { data: dncEntry } = await supabase
    .from("do_not_call")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("phone", contact.phone)
    .maybeSingle();
  if (dncEntry) {
    return { ok: false, status: 409, error: "This phone number is on the Do Not Call list." };
  }

  let phoneNumberQuery = supabase
    .from("phone_numbers")
    .select("id, phone_number, status")
    .eq("workspace_id", workspaceId);
  phoneNumberQuery = phoneNumberId
    ? phoneNumberQuery.eq("id", phoneNumberId)
    : phoneNumberQuery.eq("is_default", true);
  const { data: phoneNumber } = await phoneNumberQuery.maybeSingle();

  if (!phoneNumber || phoneNumber.status !== "active") {
    return { ok: false, status: 422, error: "No active phone number available to call from." };
  }

  const twilio = await getTwilioClientForWorkspace(workspaceId);
  if (!twilio) {
    return { ok: false, status: 422, error: "Twilio isn't configured for this workspace yet." };
  }

  const { data: call, error: insertError } = await supabase
    .from("calls")
    .insert({
      workspace_id: workspaceId,
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
    return { ok: false, status: 500, error: insertError?.message ?? "Failed to create call record." };
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

    return { ok: true, callId: call.id, twilioCallSid: twilioCall.sid };
  } catch (err) {
    await supabase
      .from("calls")
      .update({ status: "failed", error_message: (err as Error).message })
      .eq("id", call.id);
    return { ok: false, status: 502, error: `Twilio call failed: ${(err as Error).message}` };
  }
}
