import { describe, expect, it } from "vitest";
import {
  displayName, formatAgo, formatDuration, hostName, isOnline, leader, liveKpis,
  matchesSearch, playedCount, presenceKnown, sortLiveLobbies,
} from "~/utils/lobbyMonitorView";
import { liveLobby } from "../helpers/unifiedLobby";

describe("formatting", () => {
  it("formats seconds ago and durations", () => {
    expect(formatAgo(4.4)).toBe("4s ago");
    expect(formatAgo(125)).toBe("2m ago");
    expect(formatAgo(3 * 3600 + 120)).toBe("3h 2m ago");
    expect(formatDuration(24 * 60_000)).toBe("24m");
    expect(formatDuration(72 * 60_000)).toBe("1h 12m");
    expect(formatDuration(-5)).toBe("0m");
  });
});

describe("lobby summaries", () => {
  it("names a lobby from the doc, then the registry, then its code", () => {
    expect(displayName(liveLobby("AB12"))).toBe("Friday");
    expect(displayName(liveLobby("AB12", { lobbyName: null }))).toBe("AB12");
  });

  it("finds the host and the leader by id", () => {
    const lobby = liveLobby("AB12");
    expect(hostName(lobby)).toBe("Mo");
    expect(leader(lobby)).toEqual({ id: "u2", name: "Jess", score: 3 });
    expect(leader(liveLobby("AB12", { scores: { u1: 0 } }))).toBeNull();
  });

  it("counts plays among non-judge, non-spectator players while submitting", () => {
    expect(playedCount(liveLobby("AB12"))).toEqual({ played: 1, eligible: 2 });
    expect(playedCount(liveLobby("AB12", { phase: "judging" }))).toBeNull();
    const withSpectator = liveLobby("AB12", {
      players: [
        { id: "u1", name: "Mo" }, { id: "u2", name: "Jess" },
        { id: "u4", name: "Spec", playerType: "spectator" },
      ],
    });
    expect(playedCount(withSpectator)).toEqual({ played: 1, eligible: 1 });
  });

  it("knows presence only when every open socket identified itself", () => {
    expect(presenceKnown(liveLobby("AB12"))).toBe(true);
    expect(presenceKnown(liveLobby("AB12", { anonymousClients: 1 }))).toBe(false);
    expect(presenceKnown(liveLobby("AB12", { onlinePlayerIds: null, anonymousClients: null }))).toBe(false);
    expect(isOnline(liveLobby("AB12", { onlinePlayerIds: ["u2"] }), "u1")).toBe(false);
    expect(isOnline(liveLobby("AB12", { anonymousClients: 2 }), "u1")).toBeNull();
  });
});

describe("liveKpis", () => {
  it("counts running and waiting games, humans and bots, by source", () => {
    const kpis = liveKpis([
      liveLobby("A1"),
      liveLobby("A2", { phase: "waiting", players: [{ id: "b", name: "Jev", isBot: true }, { id: "x", name: "X" }] }, { source: "discord" }),
      liveLobby("A3", {}, { source: null, hasRegistry: false, registry: null }),
      { ...liveLobby("A4"), hasLiveDoc: false, teleportal: null },
    ]);
    expect(kpis).toEqual({
      gamesRunning: 2,
      waiting: 1,
      players: 8,
      humans: 7,
      bots: 1,
      bySource: { web: 3, discord: 1, unknown: 3 },
    });
  });
});

describe("sortLiveLobbies", () => {
  it("puts active games first by recency, then lobbies, then empty rooms, and drops registry-only rows", () => {
    const sorted = sortLiveLobbies([
      liveLobby("EMPT", { clients: 0, idleSec: 1 }),
      liveLobby("WAIT", { phase: "waiting", idleSec: 1 }),
      liveLobby("SLOW", { idleSec: 90 }),
      liveLobby("FAST", { idleSec: 2 }),
      { ...liveLobby("GONE"), hasLiveDoc: false, teleportal: null },
    ]);
    expect(sorted.map((l) => l.code)).toEqual(["FAST", "SLOW", "WAIT", "EMPT"]);
  });
});

describe("matchesSearch", () => {
  it("matches code, name, host and player names, case-insensitively", () => {
    const lobby = liveLobby("AB12");
    expect(matchesSearch(lobby, "ab1")).toBe(true);
    expect(matchesSearch(lobby, "fri")).toBe(true);
    expect(matchesSearch(lobby, "kim")).toBe(true);
    expect(matchesSearch(lobby, "zzz")).toBe(false);
    expect(matchesSearch(lobby, "")).toBe(true);
  });
});
