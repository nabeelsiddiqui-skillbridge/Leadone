import { describe, it, expect } from "vitest";

import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows requests up to the limit within the window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60).ok).toBe(true);
    }
  });

  it("blocks the request once the limit is exceeded", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60);
    const result = checkRateLimit(key, 3, 60);
    expect(result.ok).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(keyA, 3, 60);
    // keyA is now exhausted, keyB should be untouched.
    expect(checkRateLimit(keyA, 3, 60).ok).toBe(false);
    expect(checkRateLimit(keyB, 3, 60).ok).toBe(true);
  });

  it("resets the window after it expires", async () => {
    const key = `test-reset-${Math.random()}`;
    expect(checkRateLimit(key, 1, 0.05).ok).toBe(true); // 50ms window, limit 1
    expect(checkRateLimit(key, 1, 0.05).ok).toBe(false); // immediately exhausted
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(checkRateLimit(key, 1, 0.05).ok).toBe(true); // window has reset
  });
});
