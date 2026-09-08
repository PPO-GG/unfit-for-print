// server/api/issues/report.post.ts
//
// The only unauthenticated route that writes to issue_groups/issue_events.
// It is unauthenticated on purpose — guests play, and guests hit the most
// bugs — so every defense here is server-side and none of it trusts the
// client: two rate-limit buckets, a body cap, truncation, and a context
// allowlist. See docs/superpowers/specs/2026-09-08-issue-tracking-design.md.
import { BODY_MAX_BYTES, RATE_WINDOW_MS } from "~~/server/utils/issueConstants";
import { normalizeIssuePayload } from "~~/server/utils/issueIngest";
import { recordIssue } from "~~/server/utils/issueStore";
import { notifyIssue } from "~~/server/utils/issueWebhook";
import { consumeRateLimit } from "~~/server/utils/rateLimit";
import { requireAuth } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);

  // Refuse on the declared size BEFORE readBody parses anything. This is the
  // check that actually keeps a multi-megabyte body out of the JSON parser.
  const declaredBytes = Number(getRequestHeader(event, "content-length") ?? 0);
  if (declaredBytes > BODY_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "Report too large" });
  }

  const raw = await readBody(event);

  // A client can understate or omit Content-Length, so the parsed body is
  // measured too. Buffer.byteLength rather than String.length, because the
  // cap is named in bytes and .length counts UTF-16 code units — emoji and
  // non-Latin text would otherwise slip through at roughly double the cap.
  if (Buffer.byteLength(JSON.stringify(raw ?? null), "utf8") > BODY_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: "Report too large" });
  }

  const ipLimit = config.issueRateLimitIp;
  if (ipLimit > 0) {
    const ip = getRequestIP(event, { xForwardedFor: true }) || "unknown";
    const gate = consumeRateLimit(`issue:ip:${ip}`, {
      limit: ipLimit,
      windowMs: RATE_WINDOW_MS,
    });
    if (!gate.allowed) {
      setResponseHeader(event, "Retry-After", gate.retryAfterSeconds);
      throw createError({ statusCode: 429, statusMessage: "Too many reports" });
    }
  }

  const normalized = normalizeIssuePayload(raw);
  if (!normalized.ok) {
    throw createError({ statusCode: 400, statusMessage: normalized.reason });
  }

  // Second bucket: one lobby melting down must not exhaust the global budget
  // for everyone else.
  const lobbyLimit = config.issueRateLimitLobby;
  if (lobbyLimit > 0 && normalized.value.lobbyCode) {
    const gate = consumeRateLimit(`issue:lobby:${normalized.value.lobbyCode}`, {
      limit: lobbyLimit,
      windowMs: RATE_WINDOW_MS,
    });
    if (!gate.allowed) {
      setResponseHeader(event, "Retry-After", gate.retryAfterSeconds);
      throw createError({ statusCode: 429, statusMessage: "Too many reports" });
    }
  }

  // Identity is a bonus, never a requirement. An expired cookie or a bad
  // Activity token must not cost us the bug report.
  let userId: string | null = null;
  try {
    userId = await requireAuth(event);
  } catch {
    userId = null;
  }

  const result = await recordIssue(normalized.value, { userId });

  if (result.shouldNotify) {
    // Not awaited: a slow Discord must not hold the client's request open.
    void notifyIssue(result);
  }

  setResponseStatus(event, 204);
  return null;
});
