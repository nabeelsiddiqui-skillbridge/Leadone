import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveTwilioCredentials } from "@/lib/credentials";
import { verifyTwilioSignature, parseTwilioForm } from "@/lib/twilio";
import { recordCallCompletion } from "@/lib/campaign-progress";
import type { CallStatus } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

const TERMINAL_STATUSES = new Set(["completed", "busy", "no-answer", "failed", "canceled"]);

const STATUS_MAP: Record<string, CallStatus> = {
  queued: "queued",
  initiated: "initiated",
  ringing: "ringing",
  "in-progress": "in_progress",
  completed: "completed",
  busy: "busy",
  "no-answer": "no_answer",
  failed: "failed",
  canceled: "canceled",
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  const callId = url.searchParams.get("callId");
  if (!callId) return new NextResponse("Missing callId", { status: 400 });

  const db = createServiceRoleClient();
  const { data: call } = await db
    .from("calls")
    .select("id, workspace_id, campaign_id, contact_id")
    .eq("id", callId)
    .maybeSingle();
  if (!call) return new NextResponse("Unknown call", { status: 404 });

  const params = await parseTwilioForm(request);
  const creds = await resolveTwilioCredentials(call.workspace_id);
  if (!creds) return new NextResponse("Twilio not configured", { status: 500 });

  const signature = request.headers.get("X-Twilio-Signature");
  if (!verifyTwilioSignature(creds.authToken, signature, request.url, params)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const twilioStatus = params.CallStatus ?? "";
  const mapped = STATUS_MAP[twilioStatus];

  await db.from("call_events").insert({
    call_id: callId,
    workspace_id: call.workspace_id,
    event_type: "twilio_status_callback",
    payload: params,
  });

  // The realtime voice server already finalizes `calls` with its own richer
  // outcome once the media stream ends; here we just make sure the row
  // reflects Twilio's terminal status even if that process never got a
  // media stream at all (e.g. no-answer/busy/failed — the call never
  // connects, so no Media Stream ever opens).
  if (mapped) {
    const { data: current } = await db.from("calls").select("status").eq("id", callId).single();
    if (current && current.status !== "completed") {
      await db.from("calls").update({ status: mapped }).eq("id", callId);
    }
  }

  if (twilioStatus && TERMINAL_STATUSES.has(twilioStatus)) {
    // The realtime voice server (services/realtime-voice) owns finalizing
    // the `calls` row's rich outcome once a media stream actually connects;
    // this webhook is the single place that advances campaign_contacts /
    // campaign_attempts for every terminal Twilio status, connected or not.
    await recordCallCompletion({
      callId,
      workspaceId: call.workspace_id,
      campaignId: call.campaign_id,
      contactId: call.contact_id,
      twilioStatus,
    });
  }

  return new NextResponse(null, { status: 204 });
}
