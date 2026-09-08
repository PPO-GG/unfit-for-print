import { consumeRateLimit } from "./rateLimit";
import { RATE_WINDOW_MS, WEBHOOK_MAX_PER_WINDOW } from "./issueConstants";
import type { RecordIssueResult } from "./issueStore";

let suppressedSinceLastSend = 0;

/**
 * Caps outbound alerts so a bad deploy cannot spray the channel — but counts
 * what it held back, so the cap cannot silently hide a storm either. Going
 * quiet under load would be the worse failure: you would read the silence as
 * "nothing is wrong".
 */
export function __shouldSendWebhook(): {
  send: boolean;
  suppressedCount: number;
} {
  const gate = consumeRateLimit("issue:webhook", {
    limit: WEBHOOK_MAX_PER_WINDOW,
    windowMs: RATE_WINDOW_MS,
  });

  if (gate.allowed) {
    const carried = suppressedSinceLastSend;
    suppressedSinceLastSend = 0;
    return { send: true, suppressedCount: carried };
  }

  suppressedSinceLastSend += 1;
  return { send: false, suppressedCount: suppressedSinceLastSend };
}

/** Test seam: forget the suppression carry-over. Separate from
 *  __resetRateLimits, which knows nothing about this counter. */
export function __resetWebhookSuppression(): void {
  suppressedSinceLastSend = 0;
}

/**
 * Strips Discord markdown from attacker-supplied text. The ingest route is
 * unauthenticated, so `title` is arbitrary text posted into the operator's
 * private alert channel one line above a real admin link. allowed_mentions
 * stops pings; it does not stop `[click me](https://evil.example)`, nor a
 * backtick that closes the code span this is interpolated into. Nothing
 * legitimate in these alerts needs markdown.
 */
function stripMarkdown(value: string): string {
  return value.replace(/[`*_~|\\[\]()<>]/g, "").replace(/\s+/g, " ").trim();
}

export function buildIssueWebhookBody(
  result: RecordIssueResult,
  baseUrl: string,
): { content: string } {
  const label = result.isRegression ? "REGRESSION" : "New issue";
  const lobbyCode = result.lobbyCode ? stripMarkdown(result.lobbyCode) : "";
  const lobby = lobbyCode ? ` · lobby \`${lobbyCode}\`` : "";
  const title = stripMarkdown(result.title);
  return {
    content:
      `**${label}** · \`${result.kind}\`${lobby} · v${result.appVersion}\n` +
      `> ${title}\n` +
      `${baseUrl}/admin/issues/${result.groupId}`,
  };
}

/**
 * Fire-and-forget. A webhook outage, timeout, or non-2xx must never fail
 * ingest — the event is already stored, and losing the report to a failed
 * notification would defeat the point of the table. Config access is inside
 * the try too, so "never throws" is literally true, not nearly true.
 */
export async function notifyIssue(result: RecordIssueResult): Promise<void> {
  // Defence in depth. The route already checks this, but the invariant
  // "new groups and regressions only, never a muted one" belongs to the
  // function that owns notifying, not to every future caller of it.
  if (!result.shouldNotify) return;

  try {
    const config = useRuntimeConfig();
    const url = config.issueWebhookUrl;
    if (!url) return;

    const gate = __shouldSendWebhook();

    if (!gate.send) {
      // __shouldSendWebhook is synchronous, so suppressedCount === 1 here
      // means exactly "the first refusal since the last successful send" —
      // there is no window for a concurrent call to land in between. Post
      // one standalone notice now instead of staying silent for the rest of
      // the window: a storm that never produces another *allowed* send
      // (the cap holds for the full 10 minutes, say) would otherwise never
      // tell the operator anything happened until some unrelated later
      // issue carries a stale cross-window count.
      if (gate.suppressedCount === 1) {
        await $fetch(url, {
          method: "POST",
          body: {
            content:
              "_New issue alerts are being rate-limited. Further new issues in this window are suppressed; the next alert that gets through will report how many were held back._",
            allowed_mentions: { parse: [] },
          },
        });
      }
      return;
    }

    const body = buildIssueWebhookBody(result, config.public.baseUrl);
    const content =
      gate.suppressedCount > 0
        ? `${body.content}\n_(${gate.suppressedCount} more new issues suppressed)_`
        : body.content;

    await $fetch(url, {
      method: "POST",
      body: {
        content,
        // The ingest endpoint is unauthenticated and `content` embeds the
        // reporter's own text, so Discord must be told not to parse
        // mentions in it. Without this, "@everyone" in an error message
        // pings the whole server through the bug reporter.
        allowed_mentions: { parse: [] },
      },
    });
  } catch (err: any) {
    console.warn("[IssueWebhook] Failed to post:", err?.message || err);
  }
}
