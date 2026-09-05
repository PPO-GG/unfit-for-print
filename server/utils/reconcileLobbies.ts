// server/utils/reconcileLobbies.ts
// Reconciles the Postgres lobby row against the live Y.Doc.
//
// The Y.Doc is authoritative for lobby state, but Postgres is what strangers
// see: /api/lobby/list filters the public browser on `status` and `isPrivate`
// and returns `lobbyName`. Those columns used to be mirrored by watchers in
// app/pages/game/[code].vue that only run in the HOST's browser tab — so a
// host closing their tab left a lobby marked "playing" forever, and a rename
// never reached Postgres at all.
//
// Deriving the corrections server-side from Teleportal's own view of the live
// docs removes that dependency on one particular player's session.

import { eq } from "drizzle-orm";
import { useDb } from "../db/client";
import { lobbies } from "../db/schema";
import { getTeleportalHttpUrl } from "./teleportal";

const LOBBY_STATUSES = ["waiting", "playing", "complete"] as const;

/** Teleportal is a side service; never let it hold up a request. */
const SUMMARY_TIMEOUT_MS = 2000;
type LobbyStatus = (typeof LOBBY_STATUSES)[number];

/** One lobby as reported by Teleportal's /lobbies/summary. */
export interface LiveLobbySummary {
  code: string;
  status?: string;
  lobbyName?: string | null;
  isPrivate?: boolean;
}

/** The subset of a lobby row this reconciliation looks at. */
export interface ReconcilableLobbyRow {
  id: string;
  code: string;
  status: string;
  lobbyName: string | null;
  isPrivate: boolean;
}

export interface LobbyUpdate {
  id: string;
  updates: Partial<{
    status: LobbyStatus;
    lobbyName: string;
    isPrivate: boolean;
  }>;
}

function isLobbyStatus(value: unknown): value is LobbyStatus {
  return (
    typeof value === "string" && LOBBY_STATUSES.includes(value as LobbyStatus)
  );
}

/**
 * Returns the writes needed to bring lobby rows back in line with the live
 * docs. Pure: performs no I/O so the drift rules stay testable.
 *
 * Deliberately conservative:
 * - a lobby with no live doc is left alone (Teleportal may simply be
 *   unreachable; pruning orphans belongs to pruneLobbies)
 * - a field the summary omits is left alone, so this keeps working against a
 *   Teleportal build deployed before those fields were added
 * - an unrecognised status is ignored rather than written
 */
export function planLobbyReconciliation(
  rows: ReconcilableLobbyRow[],
  liveLobbies: LiveLobbySummary[],
): LobbyUpdate[] {
  const byCode = new Map<string, LiveLobbySummary>();
  for (const lobby of liveLobbies) {
    if (lobby?.code) byCode.set(lobby.code.toUpperCase(), lobby);
  }

  const plan: LobbyUpdate[] = [];

  for (const row of rows) {
    const live = byCode.get(row.code.toUpperCase());
    if (!live) continue;

    const updates: LobbyUpdate["updates"] = {};

    if (isLobbyStatus(live.status) && live.status !== row.status) {
      updates.status = live.status;
    }
    if (
      typeof live.lobbyName === "string" &&
      live.lobbyName !== row.lobbyName
    ) {
      updates.lobbyName = live.lobbyName;
    }
    if (
      typeof live.isPrivate === "boolean" &&
      live.isPrivate !== row.isPrivate
    ) {
      updates.isPrivate = live.isPrivate;
    }

    if (Object.keys(updates).length > 0) plan.push({ id: row.id, updates });
  }

  return plan;
}

/**
 * Pulls authoritative lobby state out of the live Y.Docs and writes back
 * anything Postgres has wrong.
 *
 * Callers: /api/lobby/list (so the browser filters on current data) and the
 * lobby sweeper (so rows are corrected even when nobody is browsing). Both
 * matter — reconciling only on read would mean a lobby nobody looks at stays
 * wrong indefinitely.
 *
 * Fails open: a slightly stale row beats an error because a side service is
 * down.
 *
 * @returns how many lobby rows were corrected
 */
export async function reconcileLobbiesFromLiveDocs(): Promise<number> {
  const db = useDb();

  let live: LiveLobbySummary[] = [];
  try {
    const summary = await $fetch<{ lobbies?: LiveLobbySummary[] }>(
      `${getTeleportalHttpUrl()}/lobbies/summary`,
      { timeout: SUMMARY_TIMEOUT_MS },
    );
    live = summary?.lobbies ?? [];
  } catch (err: any) {
    console.warn(
      "[reconcileLobbies] Could not reach Teleportal:",
      err?.message || err,
    );
    return 0;
  }
  if (live.length === 0) return 0;

  const rows = await db
    .select({
      id: lobbies.id,
      code: lobbies.code,
      status: lobbies.status,
      lobbyName: lobbies.lobbyName,
      isPrivate: lobbies.isPrivate,
    })
    .from(lobbies);

  let corrected = 0;
  for (const { id, updates } of planLobbyReconciliation(rows, live)) {
    try {
      await db.update(lobbies).set(updates).where(eq(lobbies.id, id));
      corrected++;
    } catch (err: any) {
      console.warn(
        `[reconcileLobbies] Failed to update lobby ${id}:`,
        err?.message || err,
      );
    }
  }
  return corrected;
}
