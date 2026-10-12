import { NextResponse } from "next/server";
import twilioLib from "twilio";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveTwilioCredentials } from "@/lib/credentials";
import { verifyTwilioSignature, parseTwilioForm } from "@/lib/twilio";
import { registerElevenLabsCall } from "@/lib/elevenlabs";

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
  const { data: call } = await db
    .from("calls")
    .select("id, workspace_id, agent_id")
    .eq("id", callId)
    .maybeSingle();
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

  if (call.agent_id) {
    const { data: agent } = await db
      .from("agents")
      .select("voice_provider, elevenlabs_agent_id")
      .eq("id", call.agent_id)
      .maybeSingle();

    if (agent?.voice_provider === "elevenlabs" && agent.elevenlabs_agent_id && params.From && params.To) {
      const result = await registerElevenLabsCall({
        elevenLabsAgentId: agent.elevenlabs_agent_id,
        fromNumber: params.From,
        toNumber: params.To,
        direction: "outbound",
        callId,
      });
      if ("twiml" in result) {
        return new NextResponse(result.twiml, { status: 200, headers: { "Content-Type": "text/xml" } });
      }
      console.error(`[call ${callId}] ElevenLabs register call failed:`, result.error);
      // Fall through to the OpenAI/realtime-voice path below rather than
      // dropping the call outright - better a call that works on the
      // fallback engine than one that just fails.
    }
  }

  // callId travels as a <Parameter> (delivered in the WebSocket's "start"
  // event), not as a query string on the stream url - Twilio's Media
  // Streams product does not reliably forward query parameters on the
  // <Stream> url, only on plain HTTP webhook callbacks like this one.
  const streamUrl = process.env.REALTIME_WEBSOCKET_URL ?? "ws://localhost:8080/media-stream";

  const twiml = new twilioLib.twiml.VoiceResponse();
  const connect = twiml.connect();
  const stream = connect.stream({ url: streamUrl });
  stream.parameter({ name: "callId", value: callId });

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
