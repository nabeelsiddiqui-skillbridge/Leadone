import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveTwilioCredentials } from "@/lib/credentials";
import { verifyTwilioSignature, parseTwilioForm } from "@/lib/twilio";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const callId = url.searchParams.get("callId");
  if (!callId) return new NextResponse("Missing callId", { status: 400 });

  const db = createServiceRoleClient();
  const { data: call } = await db.from("calls").select("id, workspace_id").eq("id", callId).maybeSingle();
  if (!call) return new NextResponse("Unknown call", { status: 404 });

  const params = await parseTwilioForm(request);
  const creds = await resolveTwilioCredentials(call.workspace_id);
  if (!creds) return new NextResponse("Twilio not configured", { status: 500 });

  const signature = request.headers.get("X-Twilio-Signature");
  if (!verifyTwilioSignature(creds.authToken, signature, request.url, params)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  if (params.RecordingStatus !== "completed") {
    return new NextResponse(null, { status: 204 });
  }

  const recordingUrl = params.RecordingUrl ? `${params.RecordingUrl}.mp3` : null;

  await db.from("call_recordings").insert({
    call_id: callId,
    workspace_id: call.workspace_id,
    twilio_recording_sid: params.RecordingSid ?? null,
    url: recordingUrl,
    duration_seconds: params.RecordingDuration ? Number(params.RecordingDuration) : null,
  });

  await db
    .from("calls")
    .update({ recording_sid: params.RecordingSid ?? null, recording_url: recordingUrl })
    .eq("id", callId);

  return new NextResponse(null, { status: 204 });
}
