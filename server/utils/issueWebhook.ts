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

export function buildIssueWebhookBody(
  result: RecordIssueResult,
  baseUrl: string,
): { content: string } {
  const label = result.isRegression ? "REGRESSION" : "New issue";
  const lobby = result.lobbyCode ? ` · lobby \`${result.lobbyCode}\`` : "";
  return {
    content:
      `**${label}** · \`${result.kind}\`${lobby} · v${result.appVersion}\n` +
      `> ${result.title}\n` +
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
    if (!gate.send) return;

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
