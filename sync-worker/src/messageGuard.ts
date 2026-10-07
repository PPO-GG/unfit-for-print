// Per-connection abuse limits, mirroring Teleportal's rateLimitConfig:
// 1 MiB max message, 200 messages per second per connection. Teleportal's
// per-document limit is gone: one room is one Durable Object, so a flood
// only ever slows its own lobby.

export const MAX_MESSAGE_BYTES = 1024 * 1024;
/** Sync step 2 is the recovery path and may carry a whole doc's diff. */
export const MAX_SYNC_STEP2_BYTES = 8 * 1024 * 1024;
export const MAX_MESSAGES_PER_SECOND = 200;
const WINDOW_MS = 1000;

export type GuardVerdict = "ok" | "too-large" | "rate-limited";

export function createMessageGuard() {
  let windowStart = Number.NEGATIVE_INFINITY;
  let count = 0;
  return {
    check(sizeBytes: number, now: number, maxBytes: number = MAX_MESSAGE_BYTES): GuardVerdict {
      if (sizeBytes > maxBytes) return "too-large";
      if (now - windowStart >= WINDOW_MS) {
        windowStart = now;
        count = 0;
      }
      count += 1;
      return count > MAX_MESSAGES_PER_SECOND ? "rate-limited" : "ok";
    },
  };
}

export type MessageGuard = ReturnType<typeof createMessageGuard>;
