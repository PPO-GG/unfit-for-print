// Pure read-side helpers for the admin lobby monitor. Everything here takes
// a UnifiedLobby from /api/admin/teleportal/status and tolerates fields an
// older sync worker leaves at their defaults.
import type { UnifiedLobby } from "~~/server/utils/mergeLobbies";
import { isActivePhase } from "./lobbyPhase";

export function formatAgo(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function displayName(lobby: UnifiedLobby): string {
  return lobby.teleportal?.lobbyName || lobby.registry?.lobbyName || lobby.code;
}

export function createdAtMs(lobby: UnifiedLobby): number | null {
  const raw = lobby.registry?.createdAt ?? lobby.teleportal?.meta?.createdAt;
  const ms = typeof raw === "number" ? raw : raw ? Date.parse(raw) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

function playerName(lobby: UnifiedLobby, id: string | null): string | null {
  if (!id) return null;
  return lobby.teleportal?.players.find((p) => p.id === id)?.name ?? null;
}

export function hostName(lobby: UnifiedLobby): string | null {
  return playerName(lobby, lobby.teleportal?.hostUserId ?? lobby.registry?.hostUserId ?? null);
}

export function judgeName(lobby: UnifiedLobby): string | null {
  return playerName(lobby, lobby.teleportal?.judgeId ?? null);
}

export function leader(lobby: UnifiedLobby): { id: string; name: string; score: number } | null {
  let best: { id: string; score: number } | null = null;
  for (const [id, score] of Object.entries(lobby.teleportal?.scores ?? {})) {
    if (!best || score > best.score) best = { id, score };
  }
  if (!best || best.score <= 0) return null;
  return { ...best, name: playerName(lobby, best.id) ?? "Unknown" };
}

export function playedCount(lobby: UnifiedLobby): { played: number; eligible: number } | null {
  const t = lobby.teleportal;
  if (!t || (t.phase !== "submitting" && t.phase !== "submitting-complete")) return null;
  const eligible = t.players.filter((p) => p.playerType !== "spectator" && p.id !== t.judgeId);
  const played = new Set(t.submittedIds);
  return { played: eligible.filter((p) => played.has(p.id)).length, eligible: eligible.length };
}

/** True only when every open socket sent a player id. */
export function presenceKnown(lobby: UnifiedLobby): boolean {
  const t = lobby.teleportal;
  return !!t && Array.isArray(t.onlinePlayerIds) && t.anonymousClients === 0;
}

/** null = can't tell (old worker or an unidentified socket). */
export function isOnline(lobby: UnifiedLobby, playerId: string): boolean | null {
  if (!presenceKnown(lobby)) return null;
  return lobby.teleportal!.onlinePlayerIds!.includes(playerId);
}

export interface LiveKpis {
  gamesRunning: number;
  waiting: number;
  players: number;
  humans: number;
  bots: number;
  /** Humans in live lobbies, by the lobby's source. */
  bySource: { discord: number; web: number; unknown: number };
}

export function liveKpis(lobbies: UnifiedLobby[]): LiveKpis {
  const kpis: LiveKpis = {
    gamesRunning: 0, waiting: 0, players: 0, humans: 0, bots: 0,
    bySource: { discord: 0, web: 0, unknown: 0 },
  };
  for (const lobby of lobbies) {
    const t = lobby.teleportal;
    if (!t) continue;
    if (isActivePhase(t.phase)) kpis.gamesRunning++;
    else if (!t.phase || t.phase === "waiting") kpis.waiting++;
    for (const p of t.players) {
      kpis.players++;
      if (p.isBot) {
        kpis.bots++;
      } else {
        kpis.humans++;
        kpis.bySource[lobby.source ?? "unknown"]++;
      }
    }
  }
  return kpis;
}

function rank(lobby: UnifiedLobby): number {
  const t = lobby.teleportal!;
  if (t.clients === 0) return 2;
  return isActivePhase(t.phase) ? 0 : 1;
}

/** Live docs only: active games by last move, then lobbies, then empty rooms. */
export function sortLiveLobbies(lobbies: UnifiedLobby[]): UnifiedLobby[] {
  return lobbies
    .filter((l) => l.hasLiveDoc && l.teleportal)
    .sort((a, b) => rank(a) - rank(b) || a.teleportal!.idleSec - b.teleportal!.idleSec);
}

export function matchesSearch(lobby: UnifiedLobby, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    lobby.code,
    displayName(lobby),
    hostName(lobby) ?? "",
    ...(lobby.teleportal?.players.map((p) => p.name) ?? []),
  ];
  return haystack.some((s) => s.toLowerCase().includes(q));
}
