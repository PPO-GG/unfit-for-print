/**
 * Labs UI types.
 *
 * Stub composables in `~/composables/useLabs*` return mock values
 * matching these interfaces; when real APIs are wired up, only the
 * composable bodies need to change.
 */

// ─── Submissions ────────────────────────────────────────────────────────────
// Matches the existing Appwrite `submission` collection shape (cardType,
// text, submitterName, pick, upvotes, upvoterIds, timestamp) plus client
// derived fields (`status` / `trend`) that are synthesized from the data.

export type SubmissionKind = "answer" | "prompt";
export type SubmissionStatus = "new" | "playtest" | "graduated" | "rejected";
export type SubmissionTrend = "hot" | null;
export type SubmissionFeedFilter = "hot" | "new" | "top" | "graduated" | "mine";

export interface LabsSubmission {
  /** Appwrite `$id`. */
  id: string;
  kind: SubmissionKind;
  text: string;
  /** For black/prompt cards — number of blanks. */
  pick?: number;
  author: string;
  /** Short (≤2 letter) initials used on the avatar. */
  initials: string;
  /** OKLCH background color for the initials avatar tile. */
  authorBg: string;
  /** Human-friendly date string ("2h ago", "Yesterday"). */
  date: string;
  /** ISO timestamp — used for sorting. */
  timestamp: string;
  up: number;
  down: number;
  /** Appwrite IDs of users who upvoted (reversible vote). */
  upvoterIds: string[];
  status: SubmissionStatus;
  trend: SubmissionTrend;
}

// ─── Card packs ─────────────────────────────────────────────────────────────
export type PackVibe =
  | "core"
  | "fresh"
  | "weird"
  | "seasonal"
  | "nostalgic"
  | "spicy"
  | "corporate"
  | "chaos"
  | "wholesome"
  | "online";

export interface LabsPack {
  id: string;
  name: string;
  /** OKLCH color used for the pack dot, header stripe, and glow. */
  color: string;
  cards: number;
  white: number;
  black: number;
  /** Total plays — 0 when we don't track it yet. */
  plays: number;
  /** Rating out of 5 — 0 when we don't track it yet. */
  rating: number;
  vibe: PackVibe;
  /** Blurb — empty string when we don't have copy for this pack. */
  desc: string;
  official: boolean;
  new: boolean;
  /** `"labs"` means the pack graduated from the Labs pipeline. */
  source?: "labs";
}

export interface LabsPackCard {
  kind: SubmissionKind;
  text: string;
}

// ─── Leaderboards ───────────────────────────────────────────────────────────
export type ContributorBadge =
  | "MAD SCIENTIST"
  | "TENURED"
  | "RESEARCHER"
  | "INTERN";

export interface LabsContributor {
  rank: number;
  name: string;
  initials: string;
  bg: string;
  submissions: number;
  graduated: number;
  totalUp: number;
  badge: ContributorBadge;
  self?: boolean;
}

export type LeaderboardWindow = "week" | "month" | "all";

// ─── Global lab stats ───────────────────────────────────────────────────────
export interface LabsStats {
  totalSubmissions: number;
  votesCast: number;
  inPlaytest: number;
  graduated: number;
  contributors: number;
  thisWeek: number;
}
