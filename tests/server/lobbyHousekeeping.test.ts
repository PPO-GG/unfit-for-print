import { describe, expect, it } from "vitest";
import { buildHousekeeping } from "~/server/utils/lobbyHousekeeping";
import type { UnifiedLobby } from "~/server/utils/mergeLobbies";

const NOW = Date.parse("2026-10-13T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

const registryOnly = (code: string, createdAt: string, status = "waiting"): UnifiedLobby => ({
  code,
  hasLiveDoc: false,
  hasRegistry: true,
  source: "web",
  teleportal: null,
  registry: { lobbyId: `id-${code}`, status, lobbyName: null, hostUserId: "h", createdAt, isPrivate: false },
});

const live = (code: string, clients: number, idleSec: number, withRegistry = true): UnifiedLobby => ({
  code,
  hasLiveDoc: true,
  hasRegistry: withRegistry,
  source: withRegistry ? "web" : null,
  teleportal: {
    docId: `lobby/lobby-${code}`, clients, idleSec, phase: "waiting", round: null, players: [], meta: {},
    lobbyName: null, isPrivate: null, hostUserId: null, judgeId: null, scores: {}, maxPoints: null,
    submittedIds: [], onlinePlayerIds: null, anonymousClients: null,
  },
  registry: withRegistry
    ? { lobbyId: `id-${code}`, status: "waiting", lobbyName: null, hostUserId: "h", createdAt: hoursAgo(1), isPrivate: false }
    : null,
});

describe("buildHousekeeping", () => {
  it("groups leftovers the way prune will treat them", () => {
    const hk = buildHousekeeping(
      [
        registryOnly("OLD1", hoursAgo(3)),
        registryOnly("NEW1", hoursAgo(0.5)),
        registryOnly("FIN1", hoursAgo(2), "complete"),
        registryOnly("FIN2", hoursAgo(0.2), "complete"),
        live("EMPT", 0, 120),
        live("BUSY", 3, 5),
        live("GHST", 2, 10, false),
      ],
      NOW,
      600,
    );
    expect(hk.dbOnlyStale).toEqual([{ code: "OLD1", ageSec: 3 * 3600 }]);
    expect(hk.dbOnlyRecent).toEqual([{ code: "NEW1", ageSec: 1800 }]);
    expect(hk.finished).toEqual([{ code: "FIN1", ageSec: 2 * 3600 }]);
    expect(hk.emptyRooms).toEqual([{ code: "EMPT", expiresInSec: 480 }]);
    expect(hk.noRecord).toEqual([{ code: "GHST", ageSec: 10 }]);
    expect(hk.leftoverCount).toBe(4);
  });

  it("never reports a negative expiry", () => {
    expect(buildHousekeeping([live("LATE", 0, 900)], NOW, 600).emptyRooms).toEqual([
      { code: "LATE", expiresInSec: 0 },
    ]);
  });
});
