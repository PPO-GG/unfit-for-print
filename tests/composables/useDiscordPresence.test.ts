// tests/composables/useDiscordPresence.test.ts
import { describe, it, expect } from "vitest";
import { mapGameStateToActivity } from "~/composables/useDiscordPresence";

describe("mapGameStateToActivity", () => {
  const BASE_TIMESTAMP = 1712150400; // 2026-04-03T12:00:00Z

  it("maps waiting phase", () => {
    const result = mapGameStateToActivity({
      phase: "waiting",
      round: 0,
      playerCount: 4,
      startTimestamp: null,
    });

    expect(result).toEqual({
      type: 0,
      details: "In Lobby",
      state: "4 players",
      assets: {
        large_image: "large_image",
        large_text: "Unfit for Print",
        small_image: "small_image",
        small_text: "In Lobby",
      },
      party: { size: [4, 8] },
    });
  });

  it("maps submitting phase with round and timestamp", () => {
    const result = mapGameStateToActivity({
      phase: "submitting",
      round: 3,
      playerCount: 6,
      startTimestamp: BASE_TIMESTAMP,
    });

    expect(result).toEqual({
      type: 0,
      details: "Playing Round 3",
      state: "Picking cards \u2014 6 players",
      assets: {
        large_image: "large_image",
        large_text: "Unfit for Print",
        small_image: "small_image",
        small_text: "Picking cards",
      },
      timestamps: { start: BASE_TIMESTAMP },
      party: { size: [6, 8] },
    });
  });

  it("maps submitting-complete same as submitting", () => {
    const result = mapGameStateToActivity({
      phase: "submitting-complete",
      round: 2,
      playerCount: 5,
      startTimestamp: BASE_TIMESTAMP,
    });

    expect(result.details).toBe("Playing Round 2");
    expect(result.state).toBe("Picking cards \u2014 5 players");
  });

  it("maps judging phase", () => {
    const result = mapGameStateToActivity({
      phase: "judging",
      round: 3,
      playerCount: 6,
      startTimestamp: BASE_TIMESTAMP,
    });

    expect(result.details).toBe("Playing Round 3");
    expect(result.state).toBe("Judging \u2014 6 players");
    expect(result.assets.small_text).toBe("Judging");
  });

  it("maps roundEnd phase", () => {
    const result = mapGameStateToActivity({
      phase: "roundEnd",
      round: 3,
      playerCount: 6,
      startTimestamp: BASE_TIMESTAMP,
    });

    expect(result.details).toBe("Playing Round 3");
    expect(result.state).toBe("Round results \u2014 6 players");
    expect(result.assets.small_text).toBe("Round results");
  });

  it("maps complete phase", () => {
    const result = mapGameStateToActivity({
      phase: "complete",
      round: 10,
      playerCount: 6,
      startTimestamp: BASE_TIMESTAMP,
    });

    expect(result).toEqual({
      type: 0,
      details: "Game Over",
      state: "6 players",
      assets: {
        large_image: "large_image",
        large_text: "Unfit for Print",
        small_image: "small_image",
        small_text: "Game Over",
      },
      timestamps: { start: BASE_TIMESTAMP },
      party: { size: [6, 8] },
    });
  });

  it("omits timestamps when startTimestamp is null", () => {
    const result = mapGameStateToActivity({
      phase: "waiting",
      round: 0,
      playerCount: 2,
      startTimestamp: null,
    });

    expect(result.timestamps).toBeUndefined();
  });

  it("handles 1 player singular", () => {
    const result = mapGameStateToActivity({
      phase: "waiting",
      round: 0,
      playerCount: 1,
      startTimestamp: null,
    });

    expect(result.state).toBe("1 player");
    expect(result.party.size).toEqual([1, 8]);
  });
});
