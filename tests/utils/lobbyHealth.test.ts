import { describe, expect, it } from "vitest";
import { lobbyHealth } from "~/utils/lobbyHealth";
import { liveLobby } from "../helpers/unifiedLobby";

const TTL = 600;
const anomaly = { groupId: "g1", title: "judge-missing", kind: "anomaly", eventCount: 2 };

describe("lobbyHealth", () => {
  it("is healthy for a busy game", () => {
    expect(lobbyHealth(liveLobby("AB12"), [], TTL)).toBeNull();
  });

  it("flags a watchdog anomaly first, but not a client error", () => {
    expect(lobbyHealth(liveLobby("AB12"), [anomaly], TTL)).toEqual({
      level: "red",
      reason: "Watchdog: judge-missing",
    });
    expect(
      lobbyHealth(liveLobby("AB12"), [{ ...anomaly, kind: "client-error" }], TTL),
    ).toBeNull();
  });

  it("flags an offline judge once the round has been quiet past the grace", () => {
    const lobby = liveLobby("AB12", { onlinePlayerIds: ["u2", "u3"], idleSec: 61 });
    expect(lobbyHealth(lobby, [], TTL)).toEqual({ level: "red", reason: "Judge Mo is offline" });
    expect(lobbyHealth(liveLobby("AB12", { onlinePlayerIds: ["u2", "u3"], idleSec: 30 }), [], TTL)).toBeNull();
  });

  it("does not call the judge offline when presence is unknown", () => {
    const lobby = liveLobby("AB12", { onlinePlayerIds: ["u2"], anonymousClients: 1, idleSec: 120 });
    expect(lobbyHealth(lobby, [], TTL)).toBeNull();
  });

  it("never calls a bot judge offline", () => {
    const players = [
      { id: "u1", name: "Mo", isBot: true },
      { id: "u2", name: "Jess", playerType: "player" },
      { id: "u3", name: "Kim", playerType: "player" },
    ];
    const over = { players, judgeId: "u1", onlinePlayerIds: ["u2", "u3"] };
    expect(lobbyHealth(liveLobby("AB12", { ...over, idleSec: 120 } as never), [], TTL)).toBeNull();
    expect(lobbyHealth(liveLobby("AB12", { ...over, idleSec: 60 } as never), [], TTL)).toBeNull();
  });

  it("calls an empty room mid-round empty, not a missing judge", () => {
    const lobby = liveLobby("AB12", {
      clients: 0, onlinePlayerIds: [], anonymousClients: 0, idleSec: 120, phase: "judging",
    });
    expect(lobbyHealth(lobby, [], TTL)).toEqual({
      level: "amber",
      reason: "Nobody connected · expires in about 8 min",
    });
  });

  it("flags a stalled round", () => {
    expect(lobbyHealth(liveLobby("AB12", { phase: "judging", idleSec: 245 }), [], TTL)).toEqual({
      level: "red",
      reason: "No moves for 4 min in Judging",
    });
    expect(lobbyHealth(liveLobby("AB12", { phase: "waiting", idleSec: 900 }), [], TTL)).toBeNull();
  });

  it("flags an empty room and a live game with no record as amber", () => {
    expect(lobbyHealth(liveLobby("AB12", { clients: 0, idleSec: 540 }), [], TTL)).toEqual({
      level: "amber",
      reason: "Nobody connected · expires in about 1 min",
    });
    expect(
      lobbyHealth(liveLobby("AB12", {}, { hasRegistry: false, registry: null, source: null }), [], TTL),
    ).toEqual({ level: "amber", reason: "Live game with no database record" });
  });

  it("ignores registry-only lobbies", () => {
    expect(lobbyHealth({ ...liveLobby("AB12"), hasLiveDoc: false, teleportal: null }, [], TTL)).toBeNull();
  });
});
