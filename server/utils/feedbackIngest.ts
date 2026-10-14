import {
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_PLATFORMS,
  FEEDBACK_SOURCES,
  FEEDBACK_TOPICS,
  type FeedbackSource,
  type FeedbackTopic,
} from "#shared/feedback";
import {
  FEEDBACK_APP_VERSION_MAX,
  FEEDBACK_GAMES_HINT_MAX,
  FEEDBACK_LOBBY_CODE_MAX,
} from "./feedbackConstants";

export interface NormalizedFeedback {
  clientRef: string;
  rating: number | null;
  topics: FeedbackTopic[];
  message: string | null;
  source: FeedbackSource;
  lobbyCode: string | null;
  gamesCompletedHint: number | null;
  platform: string | null;
  appVersion: string;
}

export type NormalizeFeedbackResult =
  | { ok: true; value: NormalizedFeedback }
  | { ok: false; reason: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Truncate rather than reject: an overlong comment is still feedback.
 *  NUL is removed first — Postgres `text` rejects it, so a hand-built request
 *  would otherwise pass validation and 500 at insert. */
function clamp(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replaceAll("\u0000", "").trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

export function normalizeFeedbackPayload(raw: unknown): NormalizeFeedbackResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "invalid body" };
  }
  const body = raw as Record<string, unknown>;

  if (typeof body.clientRef !== "string" || !UUID_RE.test(body.clientRef)) {
    return { ok: false, reason: "invalid clientRef" };
  }
  if (!FEEDBACK_SOURCES.includes(body.source as FeedbackSource)) {
    return { ok: false, reason: "invalid source" };
  }

  // Rejected, never coerced: "5" or 4.5 means a hand-built request, and
  // silently rounding it would put a number in the average nobody chose.
  let rating: number | null = null;
  if (body.rating !== undefined && body.rating !== null) {
    if (
      typeof body.rating !== "number" ||
      !Number.isInteger(body.rating) ||
      body.rating < 1 ||
      body.rating > 5
    ) {
      return { ok: false, reason: "invalid rating" };
    }
    rating = body.rating;
  }

  const message = clamp(body.message, FEEDBACK_MESSAGE_MAX);
  if (rating === null && message === null) {
    return { ok: false, reason: "empty feedback" };
  }

  const appVersion = clamp(body.appVersion, FEEDBACK_APP_VERSION_MAX);
  if (!appVersion) return { ok: false, reason: "missing appVersion" };

  const topics = Array.isArray(body.topics)
    ? [
        ...new Set(
          body.topics.filter((t): t is FeedbackTopic =>
            FEEDBACK_TOPICS.includes(t as FeedbackTopic),
          ),
        ),
      ]
    : [];

  const platform = FEEDBACK_PLATFORMS.includes(
    body.platform as (typeof FEEDBACK_PLATFORMS)[number],
  )
    ? (body.platform as string)
    : null;

  const hint = body.gamesCompletedHint;
  const gamesCompletedHint =
    typeof hint === "number" && Number.isInteger(hint) && hint >= 0
      ? Math.min(hint, FEEDBACK_GAMES_HINT_MAX)
      : null;

  return {
    ok: true,
    value: {
      clientRef: body.clientRef.toLowerCase(),
      rating,
      topics,
      message,
      source: body.source as FeedbackSource,
      lobbyCode: clamp(body.lobbyCode, FEEDBACK_LOBBY_CODE_MAX),
      gamesCompletedHint,
      platform,
      appVersion,
    },
  };
}
