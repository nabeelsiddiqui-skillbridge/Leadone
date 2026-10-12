import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getElevenLabsClient } from "@/lib/elevenlabs";
import { resolveCredential } from "@/lib/credentials";

export const runtime = "nodejs";

interface TranscriptTurn {
  role?: string;
  message?: string | null;
}

interface PostCallTranscriptionEvent {
  type: string;
  data: {
    conversation_id?: string;
    status?: string;
    transcript?: TranscriptTurn[];
    metadata?: { call_duration_secs?: number; cost?: number };
    analysis?: { call_successful?: string; transcript_summary?: string };
    conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> };
  };
}

/**
 * ElevenLabs sends this once a call it handled (via the register-call flow -
 * see src/lib/elevenlabs.ts) finishes and analysis completes. It's
 * configured once, platform-wide, in the ElevenLabs dashboard - not per
 * call - so every ElevenLabs-powered call's transcript/summary/duration
 * lands here instead of being written live the way OpenAI-powered calls are
 * (services/realtime-voice writes those turn by turn during the call
 * itself, because that call is a WebSocket this app's own server is a party
 * to; an ElevenLabs call's audio never passes through this app at all).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("ElevenLabs-Signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 401 });
  }

  const secret = await resolveCredential(null, "elevenlabs", "webhook_secret");
  if (!secret) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  }

  const client = await getElevenLabsClient();
  if (!client) {
    return NextResponse.json({ error: "elevenlabs not configured" }, { status: 500 });
  }

  let event: PostCallTranscriptionEvent;
  try {
    event = await client.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("ElevenLabs webhook signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Always 200 once verified, even for event types/shapes we don't act on -
  // ElevenLabs auto-disables webhooks after repeated non-200 responses.
  if (event.type !== "post_call_transcription") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const { data } = event;
  const callId = data.conversation_initiation_client_data?.dynamic_variables?.call_id;
  if (typeof callId !== "string") {
    console.error("ElevenLabs post-call webhook missing call_id dynamic variable", data.conversation_id);
    return NextResponse.json({ ok: true, warning: "no call_id" });
  }

  const db = createServiceRoleClient();
  const { data: call } = await db.from("calls").select("id, workspace_id").eq("id", callId).maybeSingle();
  if (!call) {
    console.error(`ElevenLabs post-call webhook: no calls row for id ${callId}`);
    return NextResponse.json({ ok: true, warning: "unknown call" });
  }

  const durationSeconds = data.metadata?.call_duration_secs ?? null;
  const costCents = typeof data.metadata?.cost === "number" ? Math.round(data.metadata.cost) : null;

  await db
    .from("calls")
    .update({
      status: "completed",
      outcome: data.analysis?.call_successful ?? null,
      summary: data.analysis?.transcript_summary ?? null,
      duration_seconds: durationSeconds,
      cost_cents: costCents,
      ended_at: new Date().toISOString(),
      elevenlabs_conversation_id: data.conversation_id ?? null,
    })
    .eq("id", callId);

  const turns = (data.transcript ?? [])
    .filter((turn) => turn.message)
    .map((turn, index) => ({
      call_id: callId,
      workspace_id: call.workspace_id,
      turn_number: index + 1,
      speaker: turn.role === "agent" ? ("agent" as const) : ("caller" as const),
      message: turn.message as string,
    }));

  if (turns.length > 0) {
    await db.from("call_transcripts").insert(turns);
  }

  return NextResponse.json({ ok: true });
}
