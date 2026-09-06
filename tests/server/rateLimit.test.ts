// @vitest-environment node
//
// In-memory request throttling. The one caller that needs it today is
// POST /api/auth/guest, which is unauthenticated and inserts a `users` row on
// every successful call — a loop against it grows the table without bound.

import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import {
  consumeRateLimit,
  __rateLimitBucketCount,
  __resetRateLimits,
} from "~/server/utils/rateLimit";

const opts = { limit: 3, windowMs: 60_000 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-06T12:00:00Z"));
  __resetRateLimits();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("consumeRateLimit", () => {
  it("allows calls up to the limit and refuses the next one", () => {
    for (let i = 0; i < 3; i++) {
      expect(consumeRateLimit("ip-1", opts).allowed).toBe(true);
    }
    expect(consumeRateLimit("ip-1", opts).allowed).toBe(false);
  });

  it("counts each key separately", () => {
    for (let i = 0; i < 3; i++) consumeRateLimit("ip-1", opts);

    expect(consumeRateLimit("ip-1", opts).allowed).toBe(false);
    expect(consumeRateLimit("ip-2", opts).allowed).toBe(true);
  });

  it("reports how many calls are left", () => {
    expect(consumeRateLimit("ip-1", opts).remaining).toBe(2);
    expect(consumeRateLimit("ip-1", opts).remaining).toBe(1);
    expect(consumeRateLimit("ip-1", opts).remaining).toBe(0);
    expect(consumeRateLimit("ip-1", opts).remaining).toBe(0);
  });

  it("slides: a call becomes available again once the oldest one ages out", () => {
    consumeRateLimit("ip-1", opts); // t+0
    vi.advanceTimersByTime(30_000);
    consumeRateLimit("ip-1", opts); // t+30s
    consumeRateLimit("ip-1", opts); // t+30s
    expect(consumeRateLimit("ip-1", opts).allowed).toBe(false);

    // t+61s — only the first call has left the window, so exactly one slot
    // opens up rather than the whole allowance resetting.
    vi.advanceTimersByTime(31_000);
    expect(consumeRateLimit("ip-1", opts).allowed).toBe(true);
    expect(consumeRateLimit("ip-1", opts).allowed).toBe(false);
  });

  it("says how long to wait, rounded up to the next whole second", () => {
    consumeRateLimit("ip-1", opts);
    vi.advanceTimersByTime(500);
    consumeRateLimit("ip-1", opts);
    consumeRateLimit("ip-1", opts);

    // The oldest call ages out 59.5s from now.
    expect(consumeRateLimit("ip-1", opts).retryAfterSeconds).toBe(60);
  });

  it("reports no wait while calls are still allowed", () => {
    expect(consumeRateLimit("ip-1", opts).retryAfterSeconds).toBe(0);
  });

  it("does not grow without bound as keys go stale", () => {
    for (let i = 0; i < 500; i++) consumeRateLimit(`ip-${i}`, opts);
    expect(__rateLimitBucketCount()).toBe(500);

    // Well past the window: the next call sweeps everything that can no
    // longer affect a decision.
    vi.advanceTimersByTime(120_000);
    consumeRateLimit("ip-fresh", opts);

    expect(__rateLimitBucketCount()).toBe(1);
  });

  it("does not let one limiter's sweep clear another's longer window", () => {
    consumeRateLimit("slow", { limit: 1, windowMs: 3_600_000 });

    vi.advanceTimersByTime(120_000);
    consumeRateLimit("fast", opts); // triggers a sweep

    expect(consumeRateLimit("slow", { limit: 1, windowMs: 3_600_000 }).allowed).toBe(
      false,
    );
  });
});
