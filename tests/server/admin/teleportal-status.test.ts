import { describe, it, expect } from "vitest";
import { mergeLobbies } from "~/server/utils/mergeLobbies";

// Minimal Teleportal /status shape for testing
const makeTeleportalDoc = (
  code: string,
  overrides: Record<string, any> = {},
) => ({
  [`lobby/lobby-${code}`]: {
    clients: 2,
    idleSec: 5,
    players: [{ id: "u1", name: "Dylan", avatar: "https://cdn.example.com/a.png", isBot: false }],
    meta: { lobbyName: "Party Night", hostName: "Dylan" },
    phase: "judging",
    round: 3,
    ...overrides,
  },
});

const makeAppwriteLobby = (code: string, overrides: Record<string, any> = {}) => ({
  $id: `lobby-doc-${code}`,
  code,
  status: "playing",
  hostUserId: "host-1",
  $createdAt: "2026-04-04T12:00:00.000Z",
  ...overrides,
});

const makeSettings = (lobbyId: string, overrides: Record<string, any> = {}) => ({
  $id: `settings-${lobbyId}`,
  lobbyId,
  lobbyName: "Party Night",
  ...overrides,
});

describe("mergeLobbies", () => {
  it("merges a matched lobby (both Teleportal + Appwrite)", () => {
    const result = mergeLobbies(
      makeTeleportalDoc("ABCD"),
      [makeAppwriteLobby("ABCD")],
      [makeSettings("lobby-doc-ABCD")],
    );
    expect(result).toHaveLength(1);
    const lobby = result[0];
    expect(lobby.code).toBe("ABCD");
    expect(lobby.hasLiveDoc).toBe(true);
    expect(lobby.hasRegistry).toBe(true);
    expect(lobby.teleportal?.clients).toBe(2);
    expect(lobby.teleportal?.phase).toBe("judging");
    expect(lobby.teleportal?.round).toBe(3);
    expect(lobby.registry?.lobbyId).toBe("lobby-doc-ABCD");
    expect(lobby.registry?.lobbyName).toBe("Party Night");
    expect(lobby.registry?.status).toBe("playing");
  });

  it("returns orphaned Appwrite lobby (no live doc)", () => {
    const result = mergeLobbies(
      {}, // no Teleportal docs
      [makeAppwriteLobby("WXYZ", { status: "complete" })],
      [makeSettings("lobby-doc-WXYZ", { lobbyName: "Old Game" })],
    );
    expect(result).toHaveLength(1);
    const lobby = result[0];
    expect(lobby.code).toBe("WXYZ");
    expect(lobby.hasLiveDoc).toBe(false);
    expect(lobby.hasRegistry).toBe(true);
    expect(lobby.teleportal).toBeNull();
    expect(lobby.registry?.status).toBe("complete");
    expect(lobby.registry?.lobbyName).toBe("Old Game");
  });

  it("returns ghost Teleportal doc (no Appwrite entry)", () => {
    const result = mergeLobbies(
      makeTeleportalDoc("QRST"),
      [], // no Appwrite lobbies
      [],
    );
    expect(result).toHaveLength(1);
    const lobby = result[0];
    expect(lobby.code).toBe("QRST");
    expect(lobby.hasLiveDoc).toBe(true);
    expect(lobby.hasRegistry).toBe(false);
    expect(lobby.registry).toBeNull();
    expect(lobby.teleportal?.clients).toBe(2);
  });

  it("sorts live lobbies first (by clients desc), then orphans (by createdAt desc)", () => {
    const docs = {
      ...makeTeleportalDoc("AAA", { clients: 1 }),
      ...makeTeleportalDoc("BBB", { clients: 5 }),
    };
    const appLobbies = [
      makeAppwriteLobby("CCC", { status: "complete" }),
      makeAppwriteLobby("DDD", { status: "complete", $createdAt: "2026-04-03T12:00:00.000Z" }),
    ];
    const settings = [
      makeSettings("lobby-doc-CCC"),
      makeSettings("lobby-doc-DDD"),
    ];
    const result = mergeLobbies(docs, appLobbies, settings);
    expect(result.map((l) => l.code)).toEqual(["BBB", "AAA", "CCC", "DDD"]);
  });

  it("handles missing settings gracefully (lobbyName null)", () => {
    const result = mergeLobbies(
      {},
      [makeAppwriteLobby("NOSET")],
      [], // no settings at all
    );
    expect(result[0].registry?.lobbyName).toBeNull();
  });

  it("extracts lobby code from various docId formats", () => {
    const docs = {
      "lobby/lobby-ABCD": {
        clients: 1, idleSec: 0, players: [], meta: {}, phase: undefined, round: undefined,
      },
    };
    const result = mergeLobbies(docs, [], []);
    expect(result[0].code).toBe("ABCD");
  });
});
