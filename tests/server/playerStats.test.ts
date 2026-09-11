import { describe, it, expect } from "vitest";
import { planStatDeltas, type RoundReport } from "~/server/utils/playerStats";

const report = (over: Partial<RoundReport> = {}): RoundReport => ({
  callerId: "judge",
  submitterIds: ["alice", "bob"],
  winnerId: "bob",
  botJudged: false,
  gameOver: false,
  participantIds: [],
  ...over,
});

const everyone = new Set(["judge", "alice", "bob", "carol"]);
const zero = {
  gamesPlayed: 0,
  gamesWon: 0,
  roundsPlayed: 0,
  roundsWon: 0,
  roundsJudged: 0,
};

describe("planStatDeltas", () => {
  it("credits submitters a round played, the winner a round won, and the caller a round judged", () => {
    const deltas = planStatDeltas(report(), everyone);

    expect(deltas.get("alice")).toEqual({ ...zero, roundsPlayed: 1 });
    expect(deltas.get("bob")).toEqual({ ...zero, roundsPlayed: 1, roundsWon: 1 });
    expect(deltas.get("judge")).toEqual({ ...zero, roundsJudged: 1 });
    expect(deltas.has("carol")).toBe(false);
  });

  it("credits no judge when a bot judged the round", () => {
    const deltas = planStatDeltas(report({ botJudged: true }), everyone);

    expect(deltas.has("judge")).toBe(false);
    expect(deltas.get("bob")).toEqual({ ...zero, roundsPlayed: 1, roundsWon: 1 });
  });

  it("on game over, credits every participant a game played and the winner a game won", () => {
    const deltas = planStatDeltas(
      report({ gameOver: true, participantIds: ["judge", "alice", "bob", "carol"] }),
      everyone,
    );

    expect(deltas.get("carol")).toEqual({ ...zero, gamesPlayed: 1 });
    expect(deltas.get("judge")).toEqual({ ...zero, gamesPlayed: 1, roundsJudged: 1 });
    expect(deltas.get("bob")).toEqual({
      ...zero,
      gamesPlayed: 1,
      gamesWon: 1,
      roundsPlayed: 1,
      roundsWon: 1,
    });
  });

  it("credits the game winner a game played even when missing from participants", () => {
    const deltas = planStatDeltas(
      report({ gameOver: true, participantIds: ["alice"] }),
      everyone,
    );

    expect(deltas.get("bob")!.gamesPlayed).toBe(1);
  });

  it("drops anyone not in the eligible set", () => {
    const deltas = planStatDeltas(report(), new Set(["alice"]));

    expect([...deltas.keys()]).toEqual(["alice"]);
  });

  it("counts a repeated id once", () => {
    const deltas = planStatDeltas(
      report({
        submitterIds: ["alice", "alice"],
        winnerId: "alice",
        gameOver: true,
        participantIds: ["alice", "alice"],
      }),
      everyone,
    );

    expect(deltas.get("alice")).toEqual({
      ...zero,
      gamesPlayed: 1,
      gamesWon: 1,
      roundsPlayed: 1,
      roundsWon: 1,
    });
  });

  it("credits no win to anyone when there is no winner (a bot won)", () => {
    const deltas = planStatDeltas(
      report({ winnerId: null, gameOver: true, participantIds: ["alice", "bob"] }),
      everyone,
    );

    for (const d of deltas.values()) {
      expect(d.roundsWon).toBe(0);
      expect(d.gamesWon).toBe(0);
    }
  });

  it("returns an empty map when nobody is eligible", () => {
    expect(planStatDeltas(report(), new Set()).size).toBe(0);
  });
});
