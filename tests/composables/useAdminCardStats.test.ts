// times_played / times_won / times_skipped have been written by the game
// engine all along and never displayed. The only subtlety is small samples:
// a card played twice and won once is not a 50% card.
import { describe, it, expect } from "vitest";
import {
  cardRate,
  packAverage,
  MIN_PLAYS_FOR_RATE,
} from "~/composables/useAdminCardStats";

const white = (timesPlayed: number, timesWon: number) =>
  ({ id: "w", text: "w", type: "white", timesPlayed, timesWon }) as never;
const black = (timesPlayed: number, timesSkipped: number) =>
  ({ id: "b", text: "b", type: "black", timesPlayed, timesSkipped }) as never;

describe("cardRate", () => {
  it("returns a win rate for a white card with enough plays", () => {
    const r = cardRate(white(200, 20));
    expect(r.kind).toBe("win");
    expect(r.value).toBeCloseTo(0.1, 5);
  });

  it("returns a skip rate for a black card with enough plays", () => {
    const r = cardRate(black(100, 30));
    expect(r.kind).toBe("skip");
    expect(r.value).toBeCloseTo(0.3, 5);
  });

  it("withholds a rate below the play threshold", () => {
    expect(cardRate(white(MIN_PLAYS_FOR_RATE - 1, 10)).value).toBeNull();
  });

  it("returns a rate exactly at the threshold", () => {
    expect(cardRate(white(MIN_PLAYS_FOR_RATE, 5)).value).toBeCloseTo(0.25, 5);
  });

  it("treats a never-played card as no rate rather than dividing by zero", () => {
    const r = cardRate(white(0, 0));
    expect(r.value).toBeNull();
    expect(Number.isNaN(r.value as number)).toBe(false);
  });

  it("treats missing counters as zero", () => {
    expect(cardRate({ id: "x", text: "x", type: "white" } as never).value).toBeNull();
  });
});

describe("packAverage", () => {
  it("averages only the cards that clear the threshold", () => {
    const cards = [white(100, 10), white(100, 20), white(2, 2)];
    expect(packAverage(cards, "win")).toBeCloseTo(0.15, 5);
  });

  it("returns null when nothing clears the threshold", () => {
    expect(packAverage([white(1, 1)], "win")).toBeNull();
  });

  it("returns null for an empty pack", () => {
    expect(packAverage([], "win")).toBeNull();
  });

  it("ignores cards of the other kind", () => {
    const cards = [white(100, 10), black(100, 50)];
    expect(packAverage(cards, "win")).toBeCloseTo(0.1, 5);
  });
});
