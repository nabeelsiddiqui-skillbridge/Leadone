import { NextResponse } from "next/server";
import twilioLib from "twilio";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveTwilioCredentials } from "@/lib/credentials";
import { verifyTwilioSignature, parseTwilioForm } from "@/lib/twilio";

export const runtime = "nodejs";

/**
 * Twilio hits this the moment an outbound call connects (the `url` we pass
 * to calls.create). We respond with TwiML that opens a bidirectional Media
 * Stream to the realtime voice server — NOT with <Say>/<Gather> — because
 * the whole point of this architecture is that the live conversation is
 * handled by a persistent WebSocket process, not by Twilio waiting on
 * request/response webhooks turn by turn.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const callId = url.searchParams.get("callId");
  if (!callId) {
    return new NextResponse("Missing callId", { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data: call } = await db.from("calls").select("id, workspace_id").eq("id", callId).maybeSingle();
  if (!call) {
    return new NextResponse("Unknown call", { status: 404 });
  }

  const params = await parseTwilioForm(request);
  const creds = await resolveTwilioCredentials(call.workspace_id);
  if (!creds) {
    return new NextResponse("Twilio not configured", { status: 500 });
  }

  const signature = request.headers.get("X-Twilio-Signature");
  if (!verifyTwilioSignature(creds.authToken, signature, request.url, params)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const streamUrl = `${process.env.REALTIME_WEBSOCKET_URL ?? "ws://localhost:8080/media-stream"}${
    process.env.REALTIME_WEBSOCKET_URL?.includes("?") ? "&" : "?"
  }callId=${encodeURIComponent(callId)}`;

  const twiml = new twilioLib.twiml.VoiceResponse();
  const connect = twiml.connect();
  connect.stream({ url: streamUrl });

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
