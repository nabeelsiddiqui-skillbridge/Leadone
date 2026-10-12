import "server-only";

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { resolveCredential } from "@/lib/credentials";
import type { Database } from "@/lib/supabase/database.types";

type AgentRow = Database["public"]["Tables"]["agents"]["Row"];

export async function getElevenLabsClient(): Promise<ElevenLabsClient | null> {
  const apiKey = await resolveCredential(null, "elevenlabs", "api_key");
  if (!apiKey) return null;
  return new ElevenLabsClient({ apiKey });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Creates or updates the ElevenLabs-side agent backing a LeadOne agent whose
 * voice_provider is 'elevenlabs' - mirrors its prompt, greeting, voice, and
 * language. Always configured for mu-law 8000Hz I/O, the one audio format
 * Twilio's Media Streams accept (see registerElevenLabsCall - Twilio
 * connects directly to ElevenLabs for these calls, so this has to match
 * exactly what the register-call flow expects).
 */
export async function syncElevenLabsAgent(
  agent: AgentRow
): Promise<{ agentId: string } | { error: string }> {
  const client = await getElevenLabsClient();
  if (!client) return { error: "No ElevenLabs API key configured. Add one in Settings → APIs first." };

  const systemPrompt =
    [agent.system_prompt, agent.conversation_instructions, agent.objection_handling, agent.closing_instructions]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join("\n\n") || "You are a helpful, friendly voice assistant.";

  // ElevenLabs wants a bare ISO language code (e.g. "en"), not a BCP-47
  // locale tag like the rest of this app uses (e.g. "en-US").
  const language = (agent.language || "en-US").split("-")[0].toLowerCase();

  const conversationConfig = {
    agent: {
      firstMessage: agent.opening_greeting || undefined,
      language,
      prompt: { prompt: systemPrompt },
    },
    tts: {
      voiceId: agent.elevenlabs_voice_id || undefined,
      agentOutputAudioFormat: "ulaw_8000" as const,
    },
  };

  try {
    if (agent.elevenlabs_agent_id) {
      await client.conversationalAi.agents.update(agent.elevenlabs_agent_id, { conversationConfig });
      return { agentId: agent.elevenlabs_agent_id };
    }
    const created = await client.conversationalAi.agents.create({ name: agent.name, conversationConfig });
    return { agentId: created.agentId };
  } catch (err) {
    return { error: `Failed to sync ElevenLabs agent: ${errorMessage(err)}` };
  }
}

/**
 * Registers a Twilio call with ElevenLabs and returns the TwiML that
 * connects it. Twilio's Media Stream then talks directly to ElevenLabs -
 * this app's own realtime-voice service is never involved for these calls.
 * `callId` travels as a dynamic variable so the post-call webhook
 * (src/app/api/webhooks/elevenlabs/post-call/route.ts) can match the
 * conversation back to this app's `calls` row.
 */
export async function registerElevenLabsCall(options: {
  elevenLabsAgentId: string;
  fromNumber: string;
  toNumber: string;
  direction: "inbound" | "outbound";
  callId: string;
}): Promise<{ twiml: string } | { error: string }> {
  const client = await getElevenLabsClient();
  if (!client) return { error: "No ElevenLabs API key configured." };

  try {
    const twiml = await client.conversationalAi.twilio.registerCall({
      agentId: options.elevenLabsAgentId,
      fromNumber: options.fromNumber,
      toNumber: options.toNumber,
      direction: options.direction,
      conversationInitiationClientData: {
        dynamicVariables: { call_id: options.callId },
      },
    });
    return { twiml };
  } catch (err) {
    return { error: `Failed to register call with ElevenLabs: ${errorMessage(err)}` };
  }
}

export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  previewUrl: string | null;
}

export async function listElevenLabsVoices(): Promise<{ voices: ElevenLabsVoice[] } | { error: string }> {
  const client = await getElevenLabsClient();
  if (!client) return { error: "No ElevenLabs API key configured." };

  try {
    const response = await client.voices.search({ pageSize: 100 });
    const voices = (response.voices ?? []).map((v) => ({
      voiceId: v.voiceId,
      name: v.name ?? v.voiceId,
      previewUrl: v.previewUrl ?? null,
    }));
    return { voices };
  } catch (err) {
    return { error: `Failed to list ElevenLabs voices: ${errorMessage(err)}` };
  }
}
