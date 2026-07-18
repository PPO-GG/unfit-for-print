/**
 * Central mock-data source for the admin dashboard.
 *
 * Replace with real API calls when the backing endpoints are ready.
 * Each `useAdmin*` composable wraps a slice of this module so pages
 * don't have to know whether the data is mocked or real.
 */

import type {
  AdminActionItem,
  AdminActivityEntry,
  AdminAnnouncement,
  AdminCardPack,
  AdminCardReport,
  AdminCardRow,
  AdminHealthRow,
  AdminKpi,
  AdminModerationSubmission,
  AdminNavSection,
  AdminRevenueSummary,
  AdminTopServer,
  AdminUserReport,
  AdminUserSummary,
} from "~/types/admin";

// ─── Navigation ──────────────────────────────────────────────────────────────
export const ADMIN_NAV: AdminNavSection[] = [
  {
    section: "Operate",
    items: [
      { id: "overview", label: "Overview", icon: "grid", to: "/admin" },
      {
        id: "moderation",
        label: "Moderation Queue",
        icon: "shield",
        to: "/admin/moderation",
        badge: 23,
      },
      {
        id: "reports",
        label: "Reports",
        icon: "flag",
        to: "/admin/reports",
        badge: 7,
        badgeColor: "danger",
      },
      {
        id: "lobbies",
        label: "Live Lobbies",
        icon: "broadcast",
        to: "/admin/lobbies",
        soon: true,
      },
    ],
  },
  {
    section: "Content",
    items: [
      { id: "cards", label: "Cards & Packs", icon: "deck", to: "/admin/cards" },
      {
        id: "announcements",
        label: "Announcements",
        icon: "megaphone",
        to: "/admin/announcements",
      },
    ],
  },
  {
    section: "Insight",
    items: [
      { id: "analytics", label: "Analytics", icon: "chart", to: "/admin/analytics", soon: true },
      { id: "revenue", label: "Revenue", icon: "coin", to: "/admin/revenue", soon: true },
      { id: "users", label: "Users", icon: "user", to: "/admin/users", soon: true },
      { id: "audit", label: "Audit Log", icon: "log", to: "/admin/audit", soon: true },
    ],
  },
];

// ─── Current user (placeholder; replace with session-derived values) ─────────
export const ADMIN_USER: AdminUserSummary = {
  name: "maxwell",
  handle: "maxwell#0420",
  role: "Lead Admin",
  initials: "MX",
  bg: "linear-gradient(135deg, #5865f2 0%, #8a4af3 100%)",
};

// ─── KPIs + sparklines ───────────────────────────────────────────────────────
export const ADMIN_KPIS: AdminKpi[] = [
  { id: "live", label: "Live Games", value: "1,284", trend: "+12.4%", up: true, sub: "vs last hour", color: "lime" },
  { id: "dau", label: "DAU", value: "47.2K", trend: "+3.1%", up: true, sub: "vs yesterday", color: "cyan" },
  { id: "mau", label: "MAU", value: "412K", trend: "+8.7%", up: true, sub: "rolling 30d", color: "yellow" },
  { id: "revenue", label: "Revenue (today)", value: "$4,182", trend: "−2.4%", up: false, sub: "vs yesterday", color: "pink" },
  { id: "queue", label: "Mod Queue", value: "23", trend: "+8 new", up: false, sub: "awaiting review", color: "yellow" },
  { id: "reports", label: "Open Reports", value: "7", trend: "−3", up: true, sub: "since 6h", color: "danger" },
];

/** Deterministic sparkline generator so we don't get hydration mismatches. */
function sparkData(n: number, base: number, jitter: number, seed: number): number[] {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    // tiny LCG for reproducible "jitter"
    s = (s * 9301 + 49297) % 233280;
    const rand = s / 233280;
    out.push(base + Math.sin(i * 0.7) * jitter * 0.5 + (rand - 0.5) * jitter);
  }
  return out;
}

export const ADMIN_KPI_SPARKS: Record<string, number[]> = {
  live: sparkData(20, 1200, 120, 1),
  dau: sparkData(20, 47000, 2000, 2),
  mau: sparkData(20, 412000, 12000, 3),
  revenue: sparkData(20, 4200, 600, 4),
  queue: sparkData(20, 22, 8, 5),
  reports: sparkData(20, 8, 4, 6),
};

// ─── Activity feed ───────────────────────────────────────────────────────────
export const ADMIN_ACTIVITY: AdminActivityEntry[] = [
  { kind: "submit", time: "2m", who: "groverclev", what: "submitted answer card", target: "\"A goose with a small business loan.\"", color: "cyan" },
  { kind: "ban", time: "8m", who: "you", what: "banned user", target: "@chumpchunk · spam in 4 lobbies", color: "danger" },
  { kind: "approve", time: "14m", who: "lex", what: "approved card", target: "\"The vibe is off.\"", color: "lime" },
  { kind: "report", time: "21m", who: "system", what: "auto-flagged answer", target: "\"___\" — repeated 4× in 1h", color: "yellow" },
  { kind: "publish", time: "44m", who: "maxwell", what: "published announcement", target: "Season 03 ends Friday", color: "pink" },
  { kind: "reject", time: "1h", who: "lex", what: "rejected card", target: "\"asdfasdf\" — gibberish", color: "danger" },
  { kind: "graduate", time: "2h", who: "system", what: "graduated card", target: "\"Crying on a Peloton.\" → Main pool", color: "cyan" },
  { kind: "submit", time: "3h", who: "myndtricks", what: "submitted prompt", target: "\"My therapist sighed and said ___.\"", color: "cyan" },
];

// ─── Overview secondary panels ───────────────────────────────────────────────
export const ADMIN_ACTION_ITEMS: AdminActionItem[] = [
  { count: "23", label: "Card submissions awaiting review", color: "yellow", to: "/admin/moderation" },
  { count: "7", label: "Open user/content reports", color: "danger", to: "/admin/reports" },
  { count: "3", label: "Scheduled announcements going live <24h", color: "cyan", to: "/admin/announcements" },
  { count: "1", label: "Pack ready to publish: Corporate Hell Vol. 2", color: "lime", to: "/admin/cards" },
  { count: "12", label: "Premium voice unlocks pending refund window", color: "pink", to: "#" },
];

export const ADMIN_HEALTH: AdminHealthRow[] = [
  { label: "Game server", value: "38ms", sub: "us-east-1", ok: true },
  { label: "Discord bot", value: "58ms", sub: "ping → gateway", ok: true },
  { label: "TTS pipeline", value: "412ms", sub: "kokoro · 99.4%", ok: true },
  { label: "Premium TTS", value: "1.2s", sub: "degraded · queue 14", warn: true },
  { label: "Database", value: "11ms", sub: "postgres · primary", ok: true },
  { label: "Payments (Discord)", value: "OK", sub: "last txn 14s ago", ok: true },
];

export const ADMIN_REVENUE: AdminRevenueSummary = {
  total: "$28,412",
  trend: "+18.2%",
  daily: [3214, 3812, 4102, 3621, 4488, 4993, 4182],
  dayLabels: ["M", "T", "W", "T", "F", "S", "S"],
  breakdown: [
    { label: "Decorations", value: "$21,108", sub: "74% of total" },
    { label: "Premium TTS", value: "$5,840", sub: "20% of total" },
    { label: "Card Packs", value: "$1,464", sub: "6% of total" },
  ],
};

export const ADMIN_TOP_SERVERS: AdminTopServer[] = [
  { name: "Goose Den", games: 412, members: "21,481", trend: "+8%" },
  { name: "After Hours Brunch", games: 388, members: "14,902", trend: "+12%" },
  { name: "Hot Take Lounge", games: 274, members: "8,217", trend: "+3%" },
  { name: "The Beanery", games: 231, members: "5,109", trend: "−2%" },
  { name: "Ironic Detachment Inc.", games: 198, members: "12,840", trend: "+22%" },
];

// ─── Moderation submissions ──────────────────────────────────────────────────
export const ADMIN_MOD_SUBMISSIONS: AdminModerationSubmission[] = [
  { id: "s1", kind: "answer", text: "A sentient Roomba with a grudge.", author: "myndtricks", date: "2h ago", up: 234, down: 12, status: "pending" },
  { id: "s2", kind: "prompt", text: "In the metaverse, the only currency is ___.", picks: 1, author: "groverclev", date: "3h ago", up: 187, down: 23, status: "playtest" },
  { id: "s3", kind: "answer", text: "Two pigeons in a trench coat doing taxes.", author: "lex_pixel", date: "5h ago", up: 412, down: 18, status: "pending" },
  { id: "s4", kind: "answer", text: "asdfasdf", author: "test_acct", date: "5h ago", up: 2, down: 39, status: "pending", flag: "auto-low-quality" },
  { id: "s5", kind: "prompt", text: "What did Grandma find in the attic? ___.", picks: 1, author: "vespergoth", date: "7h ago", up: 298, down: 14, status: "pending" },
  { id: "s6", kind: "answer", text: "Gradually becoming your dad.", author: "kade", date: "9h ago", up: 521, down: 31, status: "playtest" },
  { id: "s7", kind: "answer", text: "[REMOVED slur]", author: "anon4421", date: "11h ago", up: 0, down: 88, status: "pending", flag: "auto-toxic" },
  { id: "s8", kind: "answer", text: "An aggressively informal Slack message.", author: "joeycorp", date: "13h ago", up: 167, down: 22, status: "pending" },
];

// ─── Reports ─────────────────────────────────────────────────────────────────
export const ADMIN_CARD_REPORTS: AdminCardReport[] = [
  { id: "r1", target: "\"The CEO's new vision: ___.\"", kind: "prompt", reason: "Typo: should be 'CEO has'", reporter: "atlas_22", date: "1h ago", priority: "low" },
  { id: "r2", target: "\"Crying in a Whole Foods parking lot.\"", kind: "answer", reason: "Duplicate of existing card", reporter: "system", date: "3h ago", priority: "low" },
  { id: "r3", target: "\"Your mom on a Tuesday ___.\"", kind: "prompt", reason: "Doesn't make sense grammatically", reporter: "kade", date: "4h ago", priority: "med" },
  { id: "r4", target: "\"[slur]\"", kind: "answer", reason: "Hate speech", reporter: "vespergoth", date: "6h ago", priority: "high" },
];

export const ADMIN_USER_REPORTS: AdminUserReport[] = [
  { id: "u1", target: "@chumpchunk", reason: "Spamming the same answer in 4 lobbies", reporter: "groverclev", date: "30m ago", priority: "high", actions: 0 },
  { id: "u2", target: "@bluemoth", reason: "Harassment in lobby chat (BLOOD-2891)", reporter: "lex_pixel", date: "2h ago", priority: "high", actions: 1 },
  { id: "u3", target: "@toastedtulip", reason: "Submitting AI-generated cards", reporter: "atlas_22", date: "5h ago", priority: "med", actions: 0 },
];

// ─── Packs + cards ───────────────────────────────────────────────────────────
export const ADMIN_OFFICIAL_PACKS: AdminCardPack[] = [
  { id: "core", name: "Core Pack", count: 412, kind: "official", enabled: true, plays: "1.2M" },
  { id: "office", name: "Office Hell", count: 87, kind: "official", enabled: true, plays: "342K" },
  { id: "internet", name: "Extremely Online", count: 124, kind: "official", enabled: true, plays: "511K" },
  { id: "corp2", name: "Corporate Hell Vol. 2", count: 96, kind: "official", enabled: false, plays: "—", new: true },
  { id: "labs-grad", name: "Lab Graduates", count: 38, kind: "graduated", enabled: true, plays: "78K" },
];

export const ADMIN_SAMPLE_CARDS: AdminCardRow[] = [
  { id: "c1", kind: "answer", text: "A raccoon with a clipboard.", pack: "core", added: "2024-01-12", plays: 4291, hot: 0.78 },
  { id: "c2", kind: "answer", text: "Aggressive team-building exercises.", pack: "office", added: "2024-02-03", plays: 2104, hot: 0.62 },
  { id: "c3", kind: "answer", text: "The Council of Vibes.", pack: "internet", added: "2024-04-19", plays: 5821, hot: 0.91 },
  { id: "c4", kind: "prompt", text: "Why am I crying? ___.", picks: 1, pack: "core", added: "2024-01-12", plays: 8432, hot: 0.95 },
  { id: "c5", kind: "prompt", text: "TED Talk: ‘___ and the future of ___.’", picks: 2, pack: "core", added: "2024-01-12", plays: 6219, hot: 0.83 },
  { id: "c6", kind: "answer", text: "Crying in a Home Depot parking lot.", pack: "internet", added: "2024-04-19", plays: 7102, hot: 0.88 },
  { id: "c7", kind: "answer", text: "Emotionally unavailable houseplants.", pack: "internet", added: "2024-04-19", plays: 3104, hot: 0.71 },
  { id: "c8", kind: "answer", text: "Gradually becoming your dad.", pack: "labs-grad", added: "2025-09-08", plays: 1832, hot: 0.84 },
  { id: "c9", kind: "prompt", text: "The all-hands meeting was cancelled because ___.", picks: 1, pack: "office", added: "2024-02-03", plays: 4218, hot: 0.79 },
  { id: "c10", kind: "answer", text: "A meeting that should have been an email.", pack: "office", added: "2024-02-03", plays: 6912, hot: 0.93 },
];

// ─── Announcements ───────────────────────────────────────────────────────────
export const ADMIN_ANNOUNCEMENTS: AdminAnnouncement[] = [
  {
    id: "a1",
    title: "Season 03 'Last Call' ends Friday",
    body: "The current season wraps Friday at 11:59pm PT. Top 100 get the Founders Ring decoration. New season starts Monday with Corporate Hell Vol. 2.",
    cta: "View leaderboard",
    cta_url: "/leaderboards",
    status: "live",
    audience: "all",
    bannerColor: "yellow",
    posted: "2 days ago",
    discord_share: true,
    impressions: "1.2M",
    clicks: "84K",
    ctr: "7.0%",
  },
  {
    id: "a2",
    title: "New decorations dropped: Founder Ring",
    body: "We just released the Founder Ring (Legendary). Get it in the shop while supplies last.",
    cta: "Shop now",
    cta_url: "/store",
    status: "live",
    audience: "logged-in",
    bannerColor: "pink",
    posted: "5 days ago",
    discord_share: true,
    impressions: "892K",
    clicks: "47K",
    ctr: "5.3%",
  },
  {
    id: "a3",
    title: "Scheduled maintenance — Tuesday 2am PT",
    body: "Brief 15-minute downtime for database upgrade. Active games will be paused and resumed.",
    cta: "Learn more",
    cta_url: "/changelog",
    status: "scheduled",
    audience: "all",
    bannerColor: "cyan",
    posted: "Scheduled · in 3 days",
    discord_share: false,
    impressions: "—",
    clicks: "—",
    ctr: "—",
  },
  {
    id: "a4",
    title: "Holiday Pack '25 — pre-order open",
    body: "First 1,000 pre-orders get a free animated decoration.",
    cta: "Pre-order",
    cta_url: "/store/holiday25",
    status: "draft",
    audience: "all",
    bannerColor: "lime",
    posted: "Draft · 1d ago",
    discord_share: true,
    impressions: "—",
    clicks: "—",
    ctr: "—",
  },
  {
    id: "a5",
    title: "We hit 10M games played 🎉",
    body: "Thanks for playing. Here's a free pack on us.",
    cta: "Claim",
    cta_url: "/promo/10m",
    status: "ended",
    audience: "all",
    bannerColor: "yellow",
    posted: "3 weeks ago",
    discord_share: true,
    impressions: "2.4M",
    clicks: "612K",
    ctr: "25.5%",
  },
];
