import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface UsageForCost {
  callSeconds: number;
  twilioMinutes: number;
  aiAudioInputSeconds: number;
  aiAudioOutputSeconds: number;
}

/**
 * Converts raw usage into an estimated cost in cents, using the
 * super-admin-configurable pricing_settings table (never hardcoded, per
 * spec: "Do not hardcode prices permanently"). unit_cost_micros is
 * millionths of a dollar, so 10,000 micros = 1 cent.
 */
export async function estimateCostCents(usage: UsageForCost): Promise<number> {
  const db = createServiceRoleClient();
  const { data: pricing } = await db.from("pricing_settings").select("provider, unit, unit_cost_micros");

  const rate = (provider: string, unit: string) =>
    pricing?.find((p) => p.provider === provider && p.unit === unit)?.unit_cost_micros ?? 0;

  const twilioMicros = usage.twilioMinutes * rate("twilio", "voice_minute_usd");
  const openaiInputMicros = (usage.aiAudioInputSeconds / 60) * rate("openai", "realtime_audio_input_minute_usd");
  const openaiOutputMicros = (usage.aiAudioOutputSeconds / 60) * rate("openai", "realtime_audio_output_minute_usd");

  const totalMicros = twilioMicros + openaiInputMicros + openaiOutputMicros;
  return Math.round(totalMicros / 10_000); // 10,000 micros per cent
}
