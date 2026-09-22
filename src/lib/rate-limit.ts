import "server-only";
import { headers } from "next/headers";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding-window-ish rate limiter, scoped per server process.
 * This is intentionally simple and has a real limitation worth stating
 * plainly: it does NOT share state across multiple app instances (e.g. a
 * multi-replica deployment behind a load balancer), so someone spreading
 * requests across replicas could exceed the intended limit. For that,
 * swap the in-memory Map below for a shared store (Upstash Redis's
 * @upstash/ratelimit is the common choice on Vercel). It's still real
 * protection against a single-source brute-force/spam loop in the
 * meantime, and the interface is the same either way, so callers below
 * don't need to change if the backing store does.
 */
const buckets = new Map<string, Bucket>();

// Periodically forget old buckets so this Map doesn't grow unbounded on a
// long-lived process. Not load-bearing for correctness, just hygiene.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(key);
    }
  },
  10 * 60 * 1000
).unref?.();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
}

export function checkRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true };
}

/** Best-effort client identifier for rate limiting: the first hop in X-Forwarded-For, or "unknown". */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headerList.get("x-real-ip") ?? "unknown";
}

/**
 * Convenience wrapper for the common case: rate-limit an action by
 * (action name + client IP). Returns a user-facing error string when the
 * limit is hit, or null when the caller may proceed.
 */
export async function rateLimitOrMessage(action: string, limit: number, windowSeconds: number): Promise<string | null> {
  const ip = await getClientIp();
  const result = checkRateLimit(`${action}:${ip}`, limit, windowSeconds);
  if (result.ok) return null;
  return `Too many attempts. Please try again in ${result.retryAfterSeconds ?? windowSeconds} seconds.`;
}
