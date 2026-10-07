// Pure builders for the registry's HTTP bodies and its drift sweep. The
// shapes match teleportal-server's /lobbies/summary and /status so the web
// app's reconcileLobbies, mergeLobbies and pruneLobbies need no changes.

import { docIdFor } from "./lobbyCode";
import type { LobbyRecord } from "./types";

export const EXPIRY_MS = 10 * 60 * 1000;
/** An empty row this old means its room failed to report its own expiry. */
export const STALE_EMPTY_MS = 15 * 60 * 1000;
/** Any row this old gets its room asked whether it still exists. */
export const STALE_ANY_MS = 60 * 60 * 1000;
export const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export interface StoredLobby {
  record: LobbyRecord;
  updatedAt: number;
}

export function buildSummaryBody(records: LobbyRecord[], now: number): string {
  return JSON.stringify({
    lobbies: records.map((r) => ({
      code: r.code,
      phase: r.phase || "waiting",
      round: r.round || 0,
      players: r.players.length,
      playerNames: r.players.map((p) => p.name),
      status: r.status,
      lobbyName: r.lobbyName,
      isPrivate: r.isPrivate,
    })),
    timestamp: now,
  });
}

export function buildStatusBody(records: LobbyRecord[], now: number): string {
  const documents: Record<string, unknown> = {};
  let activeClients = 0;
  for (const r of records) {
    activeClients += r.clients;
    documents[docIdFor(r.code)] = {
      clients: r.clients,
      idleSec: Math.round((now - r.lastActivity) / 1000),
      players: r.players,
      meta: r.meta,
      phase: r.phase,
      round: r.round,
    };
  }
  return JSON.stringify({
    version: "2.0.0-durable",
    activeClients,
    activeDocuments: records.length,
    idleDocTtlSec: EXPIRY_MS / 1000,
    documents,
    timestamp: now,
  });
}

export function planSweep(
  rows: StoredLobby[],
  now: number,
): { remove: string[]; refresh: string[] } {
  const remove: string[] = [];
  const refresh: string[] = [];
  for (const { record, updatedAt } of rows) {
    const age = now - updatedAt;
    if (record.clients === 0 && age > STALE_EMPTY_MS) remove.push(record.code);
    else if (age > STALE_ANY_MS) refresh.push(record.code);
  }
  return { remove, refresh };
}
