// @vitest-environment node
//
// The snapshot is what both the watchdog and every bug report describe the
// game with. It was inlined in useGameWatchdog and untested; extracting it so
// the issue reporter could share it is also what made it testable.

import { describe, expect, it } from "vitest";
import {
  buildWatchdogSnapshot,
  detectingRuleIds,
} from "~/utils/watchdogSnapshot";

type ReactiveLike = Parameters<typeof buildWatchdogSnapshot>[0];

function reactiveStub(over: {
  gameState?: Record<string, unknown> | null;
  playerList?: Array<{ $id: string; playerType?: string }>;
  hands?: Record<string, unknown>;
  settings?: Record<string, unknown> | null;
}): ReactiveLike {
  return {
    gameState: { value: over.gameState ?? null },
    playerList: { value: over.playerList ?? [] },
    hands: { value: over.hands ?? {} },
    settings: { value: over.settings ?? null },
  } as unknown as ReactiveLike;
}

const liveGame = () =>
  reactiveStub({
    gameState: {
      phase: "submitting",
      judgeId: "judge",
      submissions: { alice: ["w1"] },
      skippedPlayers: ["carol"],
    },
    playerList: [
      { $id: "judge", playerType: "player" },
      { $id: "alice", playerType: "player" },
      { $id: "bob", playerType: "player" },
      { $id: "carol", playerType: "player" },
      { $id: "dora", playerType: "spectator" },
    ],
    hands: { judge: ["a", "b"], alice: ["c"], bob: [] },
    settings: { cardsPerPlayer: 7 },
  });

describe("buildWatchdogSnapshot", () => {
  it("returns null when there is no game", () => {
    expect(buildWatchdogSnapshot(reactiveStub({ gameState: null }))).toBeNull();
  });

  // The engine counts only non-spectators as players. A snapshot that
  // disagreed would make too-few-players and judge-missing read a roster
  // nothing else in the app agrees with.
  it("leaves spectators out of the active roster", () => {
    expect(buildWatchdogSnapshot(liveGame())?.activePlayerIds).toEqual([
      "judge",
      "alice",
      "bob",
      "carol",
    ]);
  });

  it("reduces hands to sizes and never carries a card id", () => {
    const snapshot = buildWatchdogSnapshot(liveGame())!;

    expect(snapshot.handSizes).toEqual({ judge: 2, alice: 1, bob: 0 });
    expect(JSON.stringify(snapshot)).not.toContain('"a"');
  });

  it("counts a malformed hand as empty rather than losing the snapshot", () => {
    const snapshot = buildWatchdogSnapshot(
      reactiveStub({
        gameState: { phase: "submitting", judgeId: "judge" },
        hands: { alice: null },
      }),
    );

    expect(snapshot?.handSizes).toEqual({ alice: 0 });
  });

  it("carries who played and who was skipped", () => {
    const snapshot = buildWatchdogSnapshot(liveGame())!;

    expect(snapshot.submittedPlayerIds).toEqual(["alice"]);
    expect(snapshot.skippedPlayerIds).toEqual(["carol"]);
  });

  it("falls back to a ten-card hand when settings are not loaded", () => {
    const snapshot = buildWatchdogSnapshot(
      reactiveStub({ gameState: { phase: "waiting" }, settings: null }),
    );

    expect(snapshot?.cardsPerPlayer).toBe(10);
  });
});

describe("detectingRuleIds", () => {
  it("names the rules a wedged game trips", () => {
    // Everyone eligible has played and the phase has not moved: the state the
    // "cards stuck" report arrived in.
    const snapshot = buildWatchdogSnapshot(
      reactiveStub({
        gameState: {
          phase: "submitting",
          judgeId: "judge",
          submissions: { alice: ["w1"], bob: ["w2"] },
          skippedPlayers: [],
        },
        playerList: [
          { $id: "judge", playerType: "player" },
          { $id: "alice", playerType: "player" },
          { $id: "bob", playerType: "player" },
        ],
        hands: { judge: [], alice: [], bob: [] },
      }),
    )!;

    expect(detectingRuleIds(snapshot)).toContain("submitting-settled");
  });

  it("says nothing about a game that is simply waiting on a player", () => {
    const snapshot = buildWatchdogSnapshot(
      reactiveStub({
        gameState: {
          phase: "submitting",
          judgeId: "judge",
          submissions: { alice: ["w1"] },
          skippedPlayers: [],
        },
        playerList: [
          { $id: "judge", playerType: "player" },
          { $id: "alice", playerType: "player" },
          { $id: "bob", playerType: "player" },
        ],
        hands: { judge: 10, alice: [], bob: [] },
        settings: { cardsPerPlayer: 0 },
      }),
    )!;

    expect(detectingRuleIds(snapshot)).toEqual([]);
  });
});
