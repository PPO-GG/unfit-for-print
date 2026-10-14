import { consumeRateLimit } from "./rateLimit";

/**
 * Strips Discord markdown from attacker-supplied text. The ingest routes are
 * unauthenticated, so this text lands in the operator's private channel one
 * line above a real admin link. allowed_mentions stops pings; it does not
 * stop `[click me](https://evil.example)`, nor a backtick that closes a code
 * span. Nothing legitimate in these alerts needs markdown.
 */
export function stripMarkdown(value: string): string {
  return value.replace(/[`*_~|\[\]()<>]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Caps outbound alerts for one channel — but counts what it held back, so
 * the cap cannot silently hide a storm. Each caller gets its own key and
 * counter: a burst of feedback must not suppress a crash alert.
 */
export function createWebhookThrottle(
  key: string,
  opts: { limit: number; windowMs: number },
) {
  let suppressedSinceLastSend = 0;

  return {
    shouldSend(): { send: boolean; suppressedCount: number } {
      const gate = consumeRateLimit(key, opts);
      if (gate.allowed) {
        const carried = suppressedSinceLastSend;
        suppressedSinceLastSend = 0;
        return { send: true, suppressedCount: carried };
      }
      suppressedSinceLastSend += 1;
      return { send: false, suppressedCount: suppressedSinceLastSend };
    },
    /** Test seam: forget the suppression carry-over. */
    reset(): void {
      suppressedSinceLastSend = 0;
    },
  };
}
