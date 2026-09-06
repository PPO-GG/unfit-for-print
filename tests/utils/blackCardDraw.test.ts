import { describe, it, expect } from "vitest";
import { drawEligibleBlackCard } from "~/utils/blackCardDraw";

/** Deterministic stand-in for shuffle: preserves order. */
const noShuffle = <T>(a: T[]): T[] => [...a];

describe("drawEligibleBlackCard", () => {
  it("takes the top card and reports its pick count", () => {
    const r = drawEligibleBlackCard({
      blackDeck: ["b1", "b2"],
      discardBlack: [],
      blackPicks: { b1: 1, b2: 2 },
      maxPick: 3,
      shuffleFn: noShuffle,
    });

    // The deck is popped from the end, matching nextRound's existing behaviour.
    expect(r.card).toEqual({ id: "b2", pick: 2 });
    expect(r.blackDeck).toEqual(["b1"]);
  });

  it("defaults a card with no recorded pick to 1", () => {
    const r = drawEligibleBlackCard({
      blackDeck: ["b1"],
      discardBlack: [],
      blackPicks: {},
      maxPick: 3,
      shuffleFn: noShuffle,
    });

    expect(r.card).toEqual({ id: "b1", pick: 1 });
  });

  it("discards candidates whose pick exceeds maxPick and keeps looking", () => {
    const r = drawEligibleBlackCard({
      blackDeck: ["b1", "b-too-big"],
      discardBlack: [],
      blackPicks: { b1: 1, "b-too-big": 5 },
      maxPick: 2,
      shuffleFn: noShuffle,
    });

    expect(r.card).toEqual({ id: "b1", pick: 1 });
    expect(r.discardBlack).toContain("b-too-big");
  });

  it("reshuffles the discard pile when the deck runs dry", () => {
    const r = drawEligibleBlackCard({
      blackDeck: [],
      discardBlack: ["b9"],
      blackPicks: { b9: 1 },
      maxPick: 3,
      shuffleFn: noShuffle,
    });

    expect(r.card).toEqual({ id: "b9", pick: 1 });
    expect(r.discardBlack).toEqual([]);
  });

  it("returns the exhausted sentinel when nothing is eligible", () => {
    const r = drawEligibleBlackCard({
      blackDeck: ["b-big"],
      discardBlack: [],
      blackPicks: { "b-big": 9 },
      maxPick: 2,
      shuffleFn: noShuffle,
    });

    expect(r.card).toEqual({ id: "", text: "No eligible cards remain", pick: 1 });
  });

  it("returns the sentinel for a completely empty deck and discard", () => {
    const r = drawEligibleBlackCard({
      blackDeck: [],
      discardBlack: [],
      blackPicks: {},
      maxPick: 3,
      shuffleFn: noShuffle,
    });

    expect(r.card).toEqual({ id: "", text: "No eligible cards remain", pick: 1 });
  });

  it("does not mutate its inputs", () => {
    const deck = ["b1"];
    const discard = ["b2"];
    drawEligibleBlackCard({
      blackDeck: deck,
      discardBlack: discard,
      blackPicks: { b1: 1, b2: 1 },
      maxPick: 3,
      shuffleFn: noShuffle,
    });

    expect(deck).toEqual(["b1"]);
    expect(discard).toEqual(["b2"]);
  });
});
