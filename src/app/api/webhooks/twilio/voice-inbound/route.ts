import { NextResponse } from "next/server";
import twilioLib from "twilio";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveTwilioCredentials } from "@/lib/credentials";
import { verifyTwilioSignature, parseTwilioForm } from "@/lib/twilio";

export const runtime = "nodejs";

function rejectTwiml(message: string) {
  const twiml = new twilioLib.twiml.VoiceResponse();
  twiml.say(message);
  twiml.hangup();
  return new NextResponse(twiml.toString(), { status: 200, headers: { "Content-Type": "text/xml" } });
}

/**
 * Twilio hits this the moment a call comes IN on a number whose Twilio
 * console "A call comes in" webhook is pointed here (configured manually
 * per number for now - see the Phone Numbers page). Mirrors the outbound
 * webhook (src/app/api/webhooks/twilio/voice/route.ts): we respond with
 * TwiML that opens a bidirectional Media Stream to the realtime voice
 * server, which is direction-agnostic - it just needs a `calls` row to
 * read the agent/contact from, so the only new work here is creating that
 * row before Twilio connects the stream, instead of a campaign/placeCall()
 * having already created it.
 */
export async function POST(request: Request) {
  const params = await parseTwilioForm(request);
  const to = params.To;
  const from = params.From;
  const callSid = params.CallSid;

  if (!to || !from || !callSid) {
    return new NextResponse("Missing Twilio call parameters", { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: phoneNumber } = await db
    .from("phone_numbers")
    .select("id, workspace_id, agent_id, status")
    .eq("phone_number", to)
    .maybeSingle();

  if (!phoneNumber) {
    // No workspace to check a signature against - nothing more to do.
    return new NextResponse("Unknown number", { status: 404 });
  }

  const creds = await resolveTwilioCredentials(phoneNumber.workspace_id);
  if (!creds) {
    return new NextResponse("Twilio not configured", { status: 500 });
  }

  const signature = request.headers.get("X-Twilio-Signature");
  if (!verifyTwilioSignature(creds.authToken, signature, request.url, params)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  if (phoneNumber.status !== "active" || !phoneNumber.agent_id) {
    return rejectTwiml("Thanks for calling. This number isn't set up to take calls right now. Goodbye.");
  }

  const { data: existingContact } = await db
    .from("contacts")
    .select("id")
    .eq("workspace_id", phoneNumber.workspace_id)
    .eq("phone", from)
    .maybeSingle();

  let contactId = existingContact?.id ?? null;
  if (!contactId) {
    const { data: newContact } = await db
      .from("contacts")
      .insert({ workspace_id: phoneNumber.workspace_id, phone: from, status: "new" })
      .select("id")
      .single();
    contactId = newContact?.id ?? null;
  }

  const { data: call, error: insertError } = await db
    .from("calls")
    .insert({
      workspace_id: phoneNumber.workspace_id,
      agent_id: phoneNumber.agent_id,
      contact_id: contactId,
      phone_number_id: phoneNumber.id,
      twilio_call_sid: callSid,
      direction: "inbound",
      status: "ringing",
    })
    .select("id")
    .single();

  if (insertError || !call) {
    return rejectTwiml("Sorry, something went wrong on our end. Please try again shortly.");
  }

  const streamUrl = process.env.REALTIME_WEBSOCKET_URL ?? "ws://localhost:8080/media-stream";

  const twiml = new twilioLib.twiml.VoiceResponse();
  const connect = twiml.connect();
  const stream = connect.stream({ url: streamUrl });
  stream.parameter({ name: "callId", value: call.id });

  return new NextResponse(twiml.toString(), { status: 200, headers: { "Content-Type": "text/xml" } });
}
