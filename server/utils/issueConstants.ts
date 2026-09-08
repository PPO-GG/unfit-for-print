// Every cap in the issue pipeline, in one place. These are the numbers that
// stand between a public unauthenticated write endpoint and a database with
// no backups, so they are deliberately not scattered across call sites.

export const MESSAGE_MAX = 500;
export const STACK_MAX = 4000;
export const TITLE_MAX = 120;
export const ROUTE_MAX = 200;
export const PLATFORM_MAX = 32;
export const APP_VERSION_MAX = 32;

/** Rejected above this, before the body is parsed. */
export const BODY_MAX_BYTES = 8192;

/** Past this many stored events, a group keeps counting but stops inserting
 *  rows. The bad-deploy case: 300 players hitting one error in a minute
 *  should produce a count, not 40,000 rows. */
export const EVENT_CAP_PER_GROUP = 500;

export const RATE_WINDOW_MS = 10 * 60 * 1000;
export const WEBHOOK_MAX_PER_WINDOW = 5;

export const ISSUE_KINDS = [
  "client-error",
  "api-error",
  "player-report",
  "anomaly",
  "server-error",
] as const;

/** The only keys copied out of a submitted context. */
export const ISSUE_CONTEXT_KEYS = [
  "phase",
  "round",
  "judgeId",
  "activePlayerCount",
  "submissionCount",
  "handSizes",
  "whiteDeckCount",
  "blackDeckCount",
  "isHost",
  "ruleId",
  "category",
] as const;
