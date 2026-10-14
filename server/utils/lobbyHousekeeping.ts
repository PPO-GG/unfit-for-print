// Groups the lobbies nobody is playing in, for the monitor's Housekeeping
// drawer. Uses prune's own thresholds so "would be removed" is honest.
import type { UnifiedLobby } from "./mergeLobbies";
import { DEFAULT_COMPLETED_TTL_MS, DEFAULT_ORPHAN_TTL_MS } from "./pruneThresholds";

export interface HousekeepingItem {
  code: string;
  /** Since the registry row was created; for a live doc, since its last edit. */
  ageSec: number;
}

export interface EmptyRoomItem {
  code: string;
  /** Roughly when the worker wipes it (idle TTL minus idle time). */
  expiresInSec: number;
}

export interface Housekeeping {
  /** Registry row, no live doc, not complete, older than the orphan TTL. */
  dbOnlyStale: HousekeepingItem[];
  /** Same, but younger — a default prune leaves these. */
  dbOnlyRecent: HousekeepingItem[];
  /** Complete and older than the completed TTL. */
  finished: HousekeepingItem[];
  /** Live doc with nobody connected; expires on its own. */
  emptyRooms: EmptyRoomItem[];
  /** Live doc with no registry row. */
  noRecord: HousekeepingItem[];
  /** Everything above except emptyRooms, which clean themselves up. */
  leftoverCount: number;
}

export function buildHousekeeping(
  lobbies: UnifiedLobby[],
  now: number,
  idleDocTtlSec: number,
): Housekeeping {
  const hk: Housekeeping = {
    dbOnlyStale: [],
    dbOnlyRecent: [],
    finished: [],
    emptyRooms: [],
    noRecord: [],
    leftoverCount: 0,
  };

  for (const lobby of lobbies) {
    const t = lobby.teleportal;
    if (t) {
      if (t.clients === 0) {
        hk.emptyRooms.push({ code: lobby.code, expiresInSec: Math.max(0, idleDocTtlSec - t.idleSec) });
      }
      if (!lobby.hasRegistry) hk.noRecord.push({ code: lobby.code, ageSec: t.idleSec });
      continue;
    }
    const r = lobby.registry;
    if (!r) continue;
    const ageMs = now - new Date(r.createdAt).getTime();
    const item = { code: lobby.code, ageSec: Math.round(ageMs / 1000) };
    if (r.status === "complete") {
      if (ageMs >= DEFAULT_COMPLETED_TTL_MS) hk.finished.push(item);
    } else if (ageMs >= DEFAULT_ORPHAN_TTL_MS) {
      hk.dbOnlyStale.push(item);
    } else {
      hk.dbOnlyRecent.push(item);
    }
  }

  hk.leftoverCount =
    hk.dbOnlyStale.length + hk.dbOnlyRecent.length + hk.finished.length + hk.noRecord.length;
  return hk;
}
