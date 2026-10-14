// Feedback vocabulary shared by the client modal, the ingest route and the
// admin page. Allowlists, not suggestions: POST /api/feedback is
// unauthenticated, so anything outside these sets is dropped or refused.

/** Idea-mode message cap. The server truncates too; the client enforces it
 *  so nobody types past a limit they cannot see. */
export const FEEDBACK_MESSAGE_MAX = 1000;

export const FEEDBACK_TOPICS = [
  "cards",
  "gameplay",
  "look",
  "bots",
  "other",
] as const;
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number];

/** English labels for operator-facing surfaces (admin page, Discord). The
 *  player-facing modal uses i18n keys instead. */
export const FEEDBACK_TOPIC_LABELS: Record<FeedbackTopic, string> = {
  cards: "Cards",
  gameplay: "Gameplay",
  look: "Look & feel",
  bots: "Bots",
  other: "Other",
};

export const FEEDBACK_SOURCES = ["game_over_prompt", "feedback_modal"] as const;
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number];

export const FEEDBACK_PLATFORMS = ["web", "discord-activity"] as const;
