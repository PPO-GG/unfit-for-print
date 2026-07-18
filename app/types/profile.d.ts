/**
 * Profile UI types.
 *
 * These describe the shape of data rendered by the /profile page.
 * Stub composables in `~/composables/useProfile*` return mock values
 * matching these interfaces; when real APIs are wired up, only the
 * composable bodies need to change.
 */

export type Rarity = "common" | "rare" | "epic" | "legendary";

// ─── Player profile header ──────────────────────────────────────────────────
export interface ProfilePlayer {
  id: string;
  /** Display name (uppercase for the hero). */
  name: string;
  /** Discord handle, e.g. "mynd#8847" or null when not linked. */
  discord: string | null;
  /** Avatar URL (Discord CDN or DiceBear fallback) — null shows initials. */
  avatarUrl: string | null;
  /** 2-letter uppercase initials used as avatar fallback. */
  initials: string;
  /** OKLCH background color for the initials fallback. */
  avatarBg: string;
  /** Short tagline under the name. */
  bio: string | null;
  /** Current level (1+). */
  level: number;
  /** XP toward the next level. */
  xp: number;
  /** XP required to reach level+1. */
  xpNext: number;
  /** Prestige/flair title, e.g. "Darkest Mind". */
  title: string | null;
  /** Human string, e.g. "Mar 2024". */
  joined: string;
  /** Currently equipped decoration id, or null. */
  equippedDecoration: string | null;
  /** Rarity of the equipped decoration — drives the hero ring color. */
  equippedRarity: Rarity | null;
}

// ─── Stats ──────────────────────────────────────────────────────────────────
export interface ProfileFavCard {
  text: string;
  wins: number;
}

export interface ProfileStats {
  gamesPlayed: number;
  wins: number;
  winRate: number; // 0–100
  currentStreak: number;
  bestStreak: number;
  roundsWon: number;
  cardsPlayed: number;
  /** Number of rounds the player was crowned funniest. */
  funniestCards: number;
  avgPointsPerGame: number;
  favoriteDeck: string;
  playtimeHours: number;
  /** Points scored per game over the last N matches. */
  recentPoints: number[];
  /** Win-rate percent over the last N buckets (e.g. weeks). */
  winRateTrend: number[];
  /** Most-winning answers the player has played. */
  favCards: ProfileFavCard[];
}

// ─── Achievements ───────────────────────────────────────────────────────────
export interface ProfileAchievement {
  id: string;
  name: string;
  rarity: Rarity;
  /** Emoji rendered inside the ach-icon tile. */
  icon: string;
  desc: string;
  unlocked: boolean;
  /** Human date the achievement was unlocked on. */
  date: string | null;
  /** Current progress (for locked achievements with a goal). */
  progress?: number;
  /** Target value when `progress` is set. */
  target?: number;
}

// ─── Match history ──────────────────────────────────────────────────────────
export interface ProfileMatch {
  id: string;
  /** Human-friendly date/time, e.g. "2h ago". */
  date: string;
  /** Human duration, e.g. "38m". */
  duration: string;
  rounds: number;
  /** Final placement (1 = win). */
  placement: number;
  /** Display score string, e.g. "10/24". */
  score: string;
  /** 2-letter initials of other players in the match. */
  opponents: string[];
  /** Last black-card prompt — flavor. */
  prompt: string;
}

// ─── Friends ────────────────────────────────────────────────────────────────
export type FriendStatus = "online" | "idle" | "offline";

export interface ProfileFriend {
  id: string;
  name: string;
  initials: string;
  /** OKLCH background color for the avatar tile. */
  bg: string;
  status: FriendStatus;
  /** Human activity string, e.g. "Playing", "Idle 12m", "Last seen 3h ago". */
  activity: string;
  /** Lobby code to join if they're currently playing. */
  activeLobbyCode?: string | null;
}

export type ProfileViewMode = "self" | "other";
