/**
 * Admin UI types.
 *
 * These describe the shape of data rendered by the admin dashboard.
 * The stub composables in `~/composables/useAdmin*` return mock values
 * matching these interfaces; when real APIs are wired up, only the
 * composable bodies need to change.
 */

// ─── Nav ─────────────────────────────────────────────────────────────────────
export type AdminNavIcon =
  | "grid"
  | "shield"
  | "flag"
  | "broadcast"
  | "deck"
  | "megaphone"
  | "chart"
  | "coin"
  | "user"
  | "log";

export interface AdminNavItem {
  id: string;
  label: string;
  icon: AdminNavIcon;
  /** Route target (absolute path). */
  to: string;
  /** Optional numeric badge (e.g. queue depth). */
  badge?: number;
  /** Badge flavour — defaults to accent, `danger` for urgent. */
  badgeColor?: "danger";
  /** If true, the item is non-functional placeholder ("SOON"). */
  soon?: boolean;
}

export interface AdminNavSection {
  section: string;
  items: AdminNavItem[];
}

// ─── Current admin user (derived from session, not editable here) ────────────
export interface AdminUserSummary {
  name: string;
  handle: string;
  role: string;
  initials: string;
  /** CSS background (gradient or colour) for the avatar tile. */
  bg: string;
}

// ─── KPIs ────────────────────────────────────────────────────────────────────
export type AdminKpiColor = "yellow" | "cyan" | "lime" | "pink" | "danger";

export interface AdminKpi {
  id: string;
  label: string;
  value: string;
  /** Human-readable delta — e.g. "+12.4%" or "−3". */
  trend: string;
  up: boolean;
  sub: string;
  color: AdminKpiColor;
}

// ─── Activity feed ───────────────────────────────────────────────────────────
export type AdminActivityKind =
  | "submit"
  | "ban"
  | "approve"
  | "report"
  | "publish"
  | "reject"
  | "graduate";

export type AdminActivityColor =
  | "cyan"
  | "danger"
  | "lime"
  | "yellow"
  | "pink";

export interface AdminActivityEntry {
  kind: AdminActivityKind;
  time: string;
  who: string;
  what: string;
  target: string;
  color: AdminActivityColor;
}

// ─── Moderation queue ────────────────────────────────────────────────────────
export type AdminCardKind = "prompt" | "answer";
export type AdminModerationStatus = "pending" | "playtest" | "live" | "rejected";

export interface AdminModerationSubmission {
  id: string;
  kind: AdminCardKind;
  text: string;
  /** Blanks for prompt cards, 1 by default. */
  picks?: number;
  author: string;
  date: string;
  up: number;
  down: number;
  status: AdminModerationStatus;
  /** Auto-moderation flag identifier e.g. "auto-toxic". */
  flag?: string;
}

// ─── Reports ─────────────────────────────────────────────────────────────────
export type AdminReportPriority = "low" | "med" | "high";

export interface AdminCardReport {
  id: string;
  target: string;
  kind: AdminCardKind;
  reason: string;
  reporter: string;
  date: string;
  priority: AdminReportPriority;
}

export interface AdminUserReport {
  id: string;
  /** e.g. "@chumpchunk" — already includes the @. */
  target: string;
  reason: string;
  reporter: string;
  date: string;
  priority: AdminReportPriority;
  /** Count of prior warnings/actions against the target. */
  actions: number;
}

// ─── Cards & packs ───────────────────────────────────────────────────────────
export type AdminPackKind = "official" | "graduated" | "seasonal";

export interface AdminCardPack {
  id: string;
  name: string;
  count: number;
  kind: AdminPackKind;
  enabled: boolean;
  plays: string;
  /** Pack is freshly created & not yet published. */
  new?: boolean;
}

export interface AdminCardRow {
  id: string;
  kind: AdminCardKind;
  text: string;
  picks?: number;
  pack: string;
  added: string;
  plays: number;
  /** 0–1 normalized "hot" score based on engagement. */
  hot: number;
}

// ─── Announcements ───────────────────────────────────────────────────────────
export type AdminAnnouncementStatus =
  | "live"
  | "scheduled"
  | "draft"
  | "ended";

export type AdminAnnouncementAudience = "all" | "logged-in" | "active";

export type AdminAnnouncementBannerColor = "yellow" | "pink" | "cyan" | "lime";

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  cta: string;
  cta_url: string;
  status: AdminAnnouncementStatus;
  audience: AdminAnnouncementAudience;
  bannerColor: AdminAnnouncementBannerColor;
  posted: string;
  /** Whether Discord servers can opt-in to embed the banner. */
  discord_share: boolean;
  impressions: string;
  clicks: string;
  /** Click-through rate, pre-formatted. */
  ctr: string;
}

// ─── Overview composites (action items, health, revenue, top servers) ────────
export interface AdminActionItem {
  count: string;
  label: string;
  color: "danger" | "yellow" | "cyan" | "lime" | "pink";
  to: string;
}

export interface AdminHealthRow {
  label: string;
  value: string;
  sub: string;
  ok?: boolean;
  warn?: boolean;
}

export interface AdminRevenueSummary {
  total: string;
  trend: string;
  /** Per-day values for the last 7 days, bar-chart input. */
  daily: number[];
  dayLabels: string[];
  breakdown: Array<{ label: string; value: string; sub: string }>;
}

export interface AdminTopServer {
  name: string;
  games: number;
  members: string;
  trend: string;
}
