import { FEEDBACK_TOPIC_LABELS, type FeedbackTopic } from "#shared/feedback";
import {
  FEEDBACK_RATE_WINDOW_MS,
  FEEDBACK_WEBHOOK_MAX_PER_WINDOW,
} from "./feedbackConstants";
import type { FeedbackRow } from "./feedbackStore";
import { createWebhookThrottle, stripMarkdown } from "./webhookShared";

const MESSAGE_PREVIEW_MAX = 300;

const throttle = createWebhookThrottle("feedback:webhook", {
  limit: FEEDBACK_WEBHOOK_MAX_PER_WINDOW,
  windowMs: FEEDBACK_RATE_WINDOW_MS,
});

export function buildFeedbackWebhookBody(
  row: Pick<FeedbackRow, "rating" | "topics" | "message">,
  baseUrl: string,
): { content: string } {
  const stars = row.rating ? "⭐".repeat(row.rating) : "";
  const topics = row.topics
    .map((t) => FEEDBACK_TOPIC_LABELS[t as FeedbackTopic])
    .filter(Boolean)
    .join(", ");
  const head = [stars, topics].filter(Boolean).join(" · ") || "Feedback";
  const message = stripMarkdown(row.message ?? "").slice(0, MESSAGE_PREVIEW_MAX);
  return {
    content: `**${head}**\n> ${message}\n${baseUrl}/admin/feedback`,
  };
}

/** Fire-and-forget; never throws. The row is already stored. */
export async function notifyFeedback(row: FeedbackRow): Promise<void> {
  if (!row.message) return;
  try {
    const config = useRuntimeConfig();
    const url = config.feedbackWebhookUrl || config.issueWebhookUrl;
    if (!url) return;

    const gate = throttle.shouldSend();
    if (!gate.send) {
      if (gate.suppressedCount === 1) {
        await $fetch(url, {
          method: "POST",
          body: {
            content:
              "_Feedback alerts are being rate-limited. The next one that gets through will say how many were held back; all of it is on /admin/feedback._",
            allowed_mentions: { parse: [] },
          },
        });
      }
      return;
    }

    const body = buildFeedbackWebhookBody(row, config.public.baseUrl);
    const content =
      gate.suppressedCount > 0
        ? `${body.content}\n_(${gate.suppressedCount} more comments suppressed)_`
        : body.content;

    await $fetch(url, {
      method: "POST",
      body: { content, allowed_mentions: { parse: [] } },
    });
  } catch (err: any) {
    console.warn("[FeedbackWebhook] Failed to post:", err?.message || err);
  }
}

/** Test seam. */
export function __resetFeedbackWebhookSuppression(): void {
  throttle.reset();
}
