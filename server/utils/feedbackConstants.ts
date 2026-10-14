// Server-side caps for the feedback pipeline, in one place — same reasoning
// as issueConstants.ts: these numbers stand between a public unauthenticated
// write endpoint and the database.

/** Rejected above this, before the body is parsed. 1000 CJK characters is
 *  ~3 KB of UTF-8, so 6 KiB leaves room for the rest of the payload. */
export const FEEDBACK_BODY_MAX_BYTES = 6144;

export const FEEDBACK_RATE_WINDOW_MS = 10 * 60 * 1000;
export const FEEDBACK_WEBHOOK_MAX_PER_WINDOW = 10;

export const FEEDBACK_APP_VERSION_MAX = 32;
export const FEEDBACK_LOBBY_CODE_MAX = 16;
/** A per-device counter can be edited by hand; cap it so a silly value does
 *  not skew the admin page's "regulars vs first game" reading. */
export const FEEDBACK_GAMES_HINT_MAX = 100000;
