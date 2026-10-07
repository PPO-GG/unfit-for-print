import { describe, expect, it } from "vitest";
import {
  buildStatusBody,
  buildSummaryBody,
  planSweep,
  STALE_ANY_MS,
  STALE_EMPTY_MS,
} from "../src/registryViews";
import type { LobbyRecord } from "../src/types";

const record = (code: string, over: Partial<LobbyRecord> = {}): LobbyRecord => ({
  code,
  clients: 2,
  lastActivity: 1_000,
  players: [{ id: "u1", name: "Dylan" }],
  meta: { hostName: "Dylan", status: "playing" },
  status: "playing",
  lobbyName: "Party Night",
  isPrivate: false,
  phase: "judging",
  round: 3,
  ...over,
});

describe("buildSummaryBody", () => {
  it("keeps Teleportal's /lobbies/summary shape and defaults", () => {
    const body = JSON.parse(
      buildSummaryBody([record("AB12"), record("CD34", { phase: undefined, round: undefined })], 5_000),
    );
    expect(body.timestamp).toBe(5_000);
    expect(body.lobbies).toEqual([
      { code: "AB12", phase: "judging", round: 3, players: 1, playerNames: ["Dylan"], status: "playing", lobbyName: "Party Night", isPrivate: false },
      { code: "CD34", phase: "waiting", round: 0, players: 1, playerNames: ["Dylan"], status: "playing", lobbyName: "Party Night", isPrivate: false },
    ]);
  });
});

describe("buildStatusBody", () => {
  it("keys documents by lobby/lobby-CODE with Teleportal's fields", () => {
    const body = JSON.parse(buildStatusBody([record("AB12")], 31_000));
    expect(body).toMatchObject({
      version: "2.0.0-durable",
      activeClients: 2,
      activeDocuments: 1,
      idleDocTtlSec: 600,
      timestamp: 31_000,
    });
    expect(body.documents["lobby/lobby-AB12"]).toEqual({
      clients: 2,
      idleSec: 30,
      players: [{ id: "u1", name: "Dylan" }],
      meta: { hostName: "Dylan", status: "playing" },
      phase: "judging",
      round: 3,
    });
    expect(body).not.toHaveProperty("uptime");
    expect(body).not.toHaveProperty("memoryUsage");
  });
});

describe("planSweep", () => {
  const now = 10 * STALE_ANY_MS;
  it("removes empty rows idle past 15 minutes and refreshes rows older than 1 hour", () => {
    const plan = planSweep(
      [
        { record: record("EMPTYOLD", { clients: 0 }), updatedAt: now - STALE_EMPTY_MS - 1 },
        { record: record("EMPTYNEW", { clients: 0 }), updatedAt: now - STALE_EMPTY_MS + 1 },
        { record: record("BUSYOLD", { clients: 3 }), updatedAt: now - STALE_ANY_MS - 1 },
        { record: record("BUSYNEW", { clients: 3 }), updatedAt: now - 1 },
      ],
      now,
    );
    expect(plan).toEqual({ remove: ["EMPTYOLD"], refresh: ["BUSYOLD"] });
  });
});
