// server/api/feedback.post.ts
//
// Player feedback ingest. Unauthenticated on purpose — most players are
// guests — so, like /api/issues/report, every defense is server-side: a body
// cap checked before and after parsing, an IP rate limit, and an allowlist
// validator. See docs/superpowers/specs/2026-10-14-feedback-survey-design.md.
import {
  FEEDBACK_BODY_MAX_BYTES,
  FEEDBACK_RATE_WINDOW_MS,
} from "~~/server/utils/feedbackConstants";
import { normalizeFeedbackPayload } from "~~/server/utils/feedbackIngest";
import { upsertFeedback } from "~~/server/utils/feedbackStore";
import { notifyFeedback } from "~~/server/utils/feedbackWebhook";
import { consumeRateLimit } from "~~/server/utils/rateLimit";
import { requireAuth } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);

  const declaredBytes = Number(getRequestHeader(event, "content-length") ?? 0);
  if (declaredBytes > FEEDBACK_BODY_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "Feedback too large" });
  }

  const raw = await readBody(event);
  if (Buffer.byteLength(JSON.stringify(raw ?? null), "utf8") > FEEDBACK_BODY_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "Feedback too large" });
  }

  const ipLimit = config.feedbackRateLimitIp;
  if (ipLimit > 0) {
    const ip = getRequestIP(event, { xForwardedFor: true }) || "unknown";
    const gate = consumeRateLimit(`feedback:ip:${ip}`, {
      limit: ipLimit,
      windowMs: FEEDBACK_RATE_WINDOW_MS,
    });
    if (!gate.allowed) {
      setResponseHeader(event, "Retry-After", gate.retryAfterSeconds);
      throw createError({ statusCode: 429, statusMessage: "Too much feedback" });
    }
  }

  const normalized = normalizeFeedbackPayload(raw);
  if (!normalized.ok) {
    throw createError({ statusCode: 400, statusMessage: normalized.reason });
  }

  // Identity is a bonus, never a requirement.
  let userId: string | null = null;
  try {
    userId = await requireAuth(event);
  } catch {
    userId = null;
  }

  const result = await upsertFeedback(normalized.value, { userId });
  if (result.messageIsNew) {
    // Not awaited: a slow Discord must not hold the request open.
    void notifyFeedback(result.row);
  }

  setResponseStatus(event, 204);
  return null;
});
