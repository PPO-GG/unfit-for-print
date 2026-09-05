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

const LOBBY_STATUSES = ["waiting", "playing", "complete"] as const;
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
