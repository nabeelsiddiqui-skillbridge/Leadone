import { NextResponse } from "next/server";

import { requireCurrentWorkspace } from "@/lib/auth";
import { listElevenLabsVoices } from "@/lib/elevenlabs";

export const runtime = "nodejs";

/** Feeds the agent form's ElevenLabs voice picker, shown when voice_provider = 'elevenlabs'. */
export async function GET() {
  await requireCurrentWorkspace();

  const result = await listElevenLabsVoices();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ voices: result.voices });
}
