import { describe, it, expect } from "vitest";

import { calculateCostCents, type PricingRate } from "./pricing";

const RATES: PricingRate[] = [
  { provider: "twilio", unit: "voice_minute_usd", unit_cost_micros: 14_000 }, // $0.014/min
  { provider: "openai", unit: "realtime_audio_input_minute_usd", unit_cost_micros: 100_000 }, // $0.10/min
  { provider: "openai", unit: "realtime_audio_output_minute_usd", unit_cost_micros: 200_000 }, // $0.20/min
];

describe("calculateCostCents", () => {
  it("computes zero cost for zero usage", () => {
    expect(calculateCostCents({ callSeconds: 0, twilioMinutes: 0, aiAudioInputSeconds: 0, aiAudioOutputSeconds: 0 }, RATES)).toBe(0);
  });

  it("combines twilio + openai input/output cost for a 10-minute call", () => {
    const cents = calculateCostCents(
      { callSeconds: 600, twilioMinutes: 10, aiAudioInputSeconds: 600, aiAudioOutputSeconds: 600 },
      RATES
    );
    // twilio: 10 * $0.014 = $0.14 -> 14c
    // openai input: 10 * $0.10 = $1.00 -> 100c
    // openai output: 10 * $0.20 = $2.00 -> 200c
    // total: 314c
    expect(cents).toBe(314);
  });

  it("treats an unconfigured provider/unit as zero cost rather than throwing", () => {
    const cents = calculateCostCents(
      { callSeconds: 60, twilioMinutes: 1, aiAudioInputSeconds: 60, aiAudioOutputSeconds: 60 },
      [] // no pricing rows configured at all
    );
    expect(cents).toBe(0);
  });

  it("rounds to the nearest cent", () => {
    const cents = calculateCostCents(
      { callSeconds: 30, twilioMinutes: 0.5, aiAudioInputSeconds: 0, aiAudioOutputSeconds: 0 },
      RATES
    );
    // 0.5 * 14000 micros = 7000 micros = 0.7 cents -> rounds to 1
    expect(cents).toBe(1);
  });
});
