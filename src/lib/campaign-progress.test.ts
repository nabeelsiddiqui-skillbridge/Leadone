import { describe, it, expect } from "vitest";

import { decideNextCampaignContactState } from "./campaign-progress";

const BASE_CAMPAIGN = {
  max_attempts: 3,
  retry_excluded_statuses: ["do_not_call", "wrong_number"],
  retry_busy_minutes: 120,
  retry_no_answer_minutes: 1440,
  retry_failed_minutes: 1440,
};

describe("decideNextCampaignContactState", () => {
  it("marks a connected call completed with no further retry", () => {
    const decision = decideNextCampaignContactState(BASE_CAMPAIGN, 0, "connected");
    expect(decision).toEqual({ attempts: 1, status: "completed", nextAttemptAt: null });
  });

  it("requeues a no-answer with the no-answer retry window", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const decision = decideNextCampaignContactState(BASE_CAMPAIGN, 0, "no_answer", now);
    expect(decision.status).toBe("queued");
    expect(decision.attempts).toBe(1);
    expect(decision.nextAttemptAt).toBe(new Date(now.getTime() + 1440 * 60 * 1000).toISOString());
  });

  it("requeues a busy call with the (shorter) busy retry window", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const decision = decideNextCampaignContactState(BASE_CAMPAIGN, 0, "busy", now);
    expect(decision.nextAttemptAt).toBe(new Date(now.getTime() + 120 * 60 * 1000).toISOString());
  });

  it("stops retrying once max_attempts is reached", () => {
    // Third attempt (attemptsBefore=2) hitting max_attempts=3 should complete, not requeue.
    const decision = decideNextCampaignContactState(BASE_CAMPAIGN, 2, "no_answer");
    expect(decision.attempts).toBe(3);
    expect(decision.status).toBe("completed");
    expect(decision.nextAttemptAt).toBeNull();
  });

  it("never retries an excluded outcome like do_not_call, even on the first attempt", () => {
    const decision = decideNextCampaignContactState(BASE_CAMPAIGN, 0, "do_not_call");
    expect(decision.status).toBe("completed");
    expect(decision.nextAttemptAt).toBeNull();
  });

  it("never retries wrong_number", () => {
    const decision = decideNextCampaignContactState(BASE_CAMPAIGN, 0, "wrong_number");
    expect(decision.status).toBe("completed");
  });

  it("uses the failed retry window for statuses that aren't busy/no_answer", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const decision = decideNextCampaignContactState(BASE_CAMPAIGN, 0, "failed", now);
    expect(decision.nextAttemptAt).toBe(new Date(now.getTime() + 1440 * 60 * 1000).toISOString());
  });
});
