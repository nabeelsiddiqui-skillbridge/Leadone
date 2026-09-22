import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface UsageForCost {
  callSeconds: number;
  twilioMinutes: number;
  aiAudioInputSeconds: number;
  aiAudioOutputSeconds: number;
}

export interface PricingRate {
  provider: string;
  unit: string;
  unit_cost_micros: number;
}

/**
 * Pure calculation, split out from estimateCostCents so it's unit-testable
 * without a database. unit_cost_micros is millionths of a dollar, so
 * 10,000 micros = 1 cent.
 */
export function calculateCostCents(usage: UsageForCost, rates: PricingRate[]): number {
  const rate = (provider: string, unit: string) =>
    rates.find((p) => p.provider === provider && p.unit === unit)?.unit_cost_micros ?? 0;

  const twilioMicros = usage.twilioMinutes * rate("twilio", "voice_minute_usd");
  const openaiInputMicros = (usage.aiAudioInputSeconds / 60) * rate("openai", "realtime_audio_input_minute_usd");
  const openaiOutputMicros = (usage.aiAudioOutputSeconds / 60) * rate("openai", "realtime_audio_output_minute_usd");

  const totalMicros = twilioMicros + openaiInputMicros + openaiOutputMicros;
  return Math.round(totalMicros / 10_000); // 10,000 micros per cent
}

/**
 * Converts raw usage into an estimated cost in cents, using the
 * super-admin-configurable pricing_settings table (never hardcoded, per
 * spec: "Do not hardcode prices permanently").
 */
export async function estimateCostCents(usage: UsageForCost): Promise<number> {
  const db = createServiceRoleClient();
  const { data: pricing } = await db.from("pricing_settings").select("provider, unit, unit_cost_micros");
  return calculateCostCents(usage, pricing ?? []);
}
