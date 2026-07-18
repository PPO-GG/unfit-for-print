/**
 * Mock data for the /profile page.
 *
 * Every field here is a placeholder — the metrics pipeline, achievements
 * system, match-history store, and friends graph don't exist yet. See
 * `docs/ui-overhaul-future-features.md` for the wiring plan for each of
 * these surfaces.
 *
 * The per-surface composables (useProfileStats / useProfileAchievements /
 * etc.) re-export slices of this module so when real APIs ship we only
 * need to update the wrapper bodies — components stay untouched.
 */

import type {
  ProfileAchievement,
  ProfileFriend,
  ProfileMatch,
  ProfileStats,
} from "~/types/profile";

export const PROFILE_STATS_MOCK: ProfileStats = {
  gamesPlayed: 142,
  wins: 38,
  winRate: 27,
  currentStreak: 4,
  bestStreak: 9,
  roundsWon: 218,
  cardsPlayed: 1842,
  funniestCards: 74,
  avgPointsPerGame: 6.2,
  favoriteDeck: "Late Night",
  playtimeHours: 48,
  recentPoints: [5, 6, 4, 8, 7, 5, 10, 3, 7, 8, 6, 9, 7, 8, 6, 10, 7, 8, 9, 10],
  winRateTrend: [22, 23, 24, 24, 26, 25, 27, 27],
  favCards: [
    { text: "A sentient Roomba with a grudge.", wins: 7 },
    { text: "Unwarranted optimism.", wins: 5 },
    { text: "Whatever Karen ordered.", wins: 4 },
  ],
};

export const PROFILE_ACHIEVEMENTS_MOCK: ProfileAchievement[] = [
  { id: "first-win", name: "First Blood", rarity: "common", icon: "🩸", desc: "Win your first round", unlocked: true, date: "Mar 14" },
  { id: "flawless", name: "Flawless Victory", rarity: "epic", icon: "👑", desc: "Win a game without losing a round", unlocked: true, date: "Apr 02" },
  { id: "century", name: "Century Club", rarity: "rare", icon: "💯", desc: "Play 100 games", unlocked: true, date: "Sep 11" },
  { id: "savage", name: "Most Savage", rarity: "epic", icon: "💀", desc: "Win a game as the funniest for 5 rounds in a row", unlocked: true, date: "Oct 03" },
  { id: "night-owl", name: "Night Owl", rarity: "rare", icon: "🦉", desc: "Play a game after 3am", unlocked: true, date: "May 28" },
  { id: "comeback", name: "Comeback Kid", rarity: "rare", icon: "📈", desc: "Win after being last place at round 10", unlocked: true, date: "Jul 19" },
  { id: "friends", name: "Squad Goals", rarity: "common", icon: "🤝", desc: "Play with 5 different people", unlocked: true, date: "Mar 20" },
  { id: "year", name: "Veteran", rarity: "legendary", icon: "🏆", desc: "Play for 365 consecutive days", unlocked: false, date: null, progress: 284, target: 365 },
  { id: "perfect", name: "Perfect Stranger", rarity: "legendary", icon: "🌌", desc: "Win a game with players you've never played before", unlocked: false, date: null },
  { id: "critic", name: "Hard To Please", rarity: "epic", icon: "🎭", desc: "Be the judge in 50 rounds", unlocked: false, date: null, progress: 34, target: 50 },
];

export const PROFILE_MATCHES_MOCK: ProfileMatch[] = [
  { id: "m01", date: "2h ago", duration: "38m", rounds: 14, placement: 1, score: "10/24", opponents: ["GR", "LE", "MX", "JF"], prompt: "The REAL reason my therapist retired." },
  { id: "m02", date: "Yesterday", duration: "52m", rounds: 18, placement: 3, score: "7/24", opponents: ["GR", "LE", "MX"], prompt: "What I keep in my emotional baggage." },
  { id: "m03", date: "2 days ago", duration: "41m", rounds: 15, placement: 1, score: "10/24", opponents: ["JF", "PP", "MX", "GR"], prompt: "The twist ending nobody asked for." },
  { id: "m04", date: "3 days ago", duration: "29m", rounds: 11, placement: 2, score: "8/24", opponents: ["LE", "GR"], prompt: "Grandma's secret recipe." },
  { id: "m05", date: "5 days ago", duration: "63m", rounds: 20, placement: 4, score: "5/24", opponents: ["MX", "JF", "GR", "PP", "LE"], prompt: "My Spotify Wrapped was ruined by ___." },
  { id: "m06", date: "1 week ago", duration: "45m", rounds: 16, placement: 1, score: "10/24", opponents: ["PP", "GR"], prompt: "The real meaning of Christmas." },
];

export const PROFILE_FRIENDS_MOCK: ProfileFriend[] = [
  { id: "grover", name: "GROVER", bg: "oklch(72% 0.22 355)", initials: "GR", status: "online", activity: "In a lobby" },
  { id: "leela", name: "LEELA", bg: "oklch(80% 0.20 140)", initials: "LE", status: "online", activity: "Playing", activeLobbyCode: null },
  { id: "maxwell", name: "MAXWELL", bg: "oklch(70% 0.22 260)", initials: "MX", status: "idle", activity: "Idle 12m" },
  { id: "jfrog", name: "JFROG", bg: "oklch(82% 0.18 95)", initials: "JF", status: "offline", activity: "Last seen 3h ago" },
  { id: "pepper", name: "PEPPER", bg: "oklch(72% 0.18 20)", initials: "PP", status: "online", activity: "Browsing" },
];

/** Placeholder level/xp/title/bio values layered on top of the real user. */
export const PROFILE_PLAYER_OVERLAY_MOCK = {
  level: 27,
  xp: 6420,
  xpNext: 8000,
  title: "Darkest Mind",
  bio: "professional bad decision maker",
};
