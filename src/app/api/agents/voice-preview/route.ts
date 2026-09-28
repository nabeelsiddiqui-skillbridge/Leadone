import { NextResponse } from "next/server";
import OpenAI from "openai";

import { requireCurrentWorkspace } from "@/lib/auth";
import { resolveCredential } from "@/lib/credentials";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Kept in sync with the Realtime API's supported built-in voices (see
// node_modules/openai/src/resources/realtime/realtime.ts) - the set the
// agent form's voice picker actually offers.
const REALTIME_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
]);

const PREVIEW_TEXT =
  "Hi, this is your AI calling assistant. Here's a quick preview of how I sound on a call.";

/** Streams a short TTS sample of an agent voice so it can be previewed before picking it. */
export async function GET(request: Request) {
  const { workspace } = await requireCurrentWorkspace();

  const { searchParams } = new URL(request.url);
  const voice = searchParams.get("voice") ?? "";
  if (!REALTIME_VOICES.has(voice)) {
    return NextResponse.json({ error: "Unknown voice." }, { status: 400 });
  }

  const rateLimit = checkRateLimit(`voice-preview:${workspace.id}`, 20, 60);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: `Too many preview requests. Try again in ${rateLimit.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  const apiKey = await resolveCredential(workspace.id, "openai", "api_key");
  if (!apiKey) {
    return NextResponse.json(
      { error: "No OpenAI API key is configured. Add one under Integrations." },
      { status: 400 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: PREVIEW_TEXT,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate voice preview." },
      { status: 502 }
    );
  }
}
