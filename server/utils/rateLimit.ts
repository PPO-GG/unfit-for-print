// server/utils/rateLimit.ts
//
// A sliding-window request counter held in process memory.
//
// Deliberately not backed by Postgres or Redis: the routes that need it are
// hot, unauthenticated paths where a database round-trip per attempt would
// hand an attacker a cheaper way to hurt us than the thing being limited. The
// trade-off is that the counts are per-process and reset on deploy, which is
// the right shape for "stop a loop", not for "enforce a quota".
//
// A sliding window rather than a fixed one: a fixed window lets twice the
// allowance through across a boundary, which for account creation is the
// difference between 5 rows and 10 in the same second.

interface RateLimitOptions {
  /** How many calls the key may make inside the window. */
  limit: number;
  /** Width of the window, in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Calls still available to this key right now. */
  remaining: number;
  /** Seconds until the next call would be allowed; 0 while under the limit. */
  retryAfterSeconds: number;
}

interface Bucket {
  /** Timestamps of the calls still inside the window, oldest first. */
  hits: number[];
  /** Kept per bucket so one limiter's sweep cannot evict another's
   *  longer-lived entries. */
  windowMs: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** Drops buckets whose newest hit has aged out of their own window. Runs at
 *  most once per minute so a burst of distinct keys does not turn every call
 *  into a full scan. */
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    const newest = bucket.hits[bucket.hits.length - 1];
    if (newest === undefined || newest <= now - bucket.windowMs) {
      buckets.delete(key);
    }
  }
}

/**
 * Records one call against `key` and says whether it is allowed.
 *
 * Refused calls are NOT recorded, so hammering a limited key does not extend
 * the wait — the window still clears on the schedule the allowed calls set.
 */
export function consumeRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key) ?? { hits: [], windowMs };
  bucket.windowMs = windowMs;
  bucket.hits = bucket.hits.filter((at) => at > now - windowMs);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0]!;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldest + windowMs - now) / 1000),
      ),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  return {
    allowed: true,
    remaining: limit - bucket.hits.length,
    retryAfterSeconds: 0,
  };
}

/** Test seam: number of tracked keys. */
export function __rateLimitBucketCount(): number {
  return buckets.size;
}

/** Test seam: forget every key. */
export function __resetRateLimits(): void {
  buckets.clear();
  lastSweep = 0;
}
