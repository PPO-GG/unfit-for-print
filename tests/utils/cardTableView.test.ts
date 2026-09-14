import { describe, it, expect } from "vitest";
import { filterCards, sortCards, cardCounts } from "~/utils/cardTableView";
import type { AdminCard } from "~/types/adminCard";

const card = (id: string, over: Partial<AdminCard> = {}): AdminCard => ({
  id, type: "white", text: id, packId: "p", pack: "P", active: true, ...over,
});
const cards = [
  card("Banana", { timesPlayed: 100, timesWon: 50 }),
  card("apple", { timesPlayed: 5, timesWon: 5 }),
  card("Cherry?", { type: "black", active: false, timesPlayed: 40, timesSkipped: 4 }),
];

describe("filterCards", () => {
  it("filters by type, inactive, and text search", () => {
    expect(filterCards(cards, { type: "black", q: "" }).map((c) => c.id)).toEqual(["Cherry?"]);
    expect(filterCards(cards, { type: "inactive", q: "" }).map((c) => c.id)).toEqual(["Cherry?"]);
    expect(filterCards(cards, { type: "all", q: "APP" }).map((c) => c.id)).toEqual(["apple"]);
  });
});

describe("sortCards", () => {
  it("keeps order for null and sorts text case-insensitively", () => {
    expect(sortCards(cards, null)).toEqual(cards);
    expect(sortCards(cards, { key: "text", desc: false }).map((c) => c.id)).toEqual(["apple", "Banana", "Cherry?"]);
  });

  it("puts cards without a rate last in both directions", () => {
    expect(sortCards(cards, { key: "rate", desc: true }).map((c) => c.id)).toEqual(["Banana", "Cherry?", "apple"]);
    expect(sortCards(cards, { key: "rate", desc: false }).map((c) => c.id)).toEqual(["Cherry?", "Banana", "apple"]);
  });

  it("does not mutate its input", () => {
    const copy = [...cards];
    sortCards(cards, { key: "played", desc: true });
    expect(cards).toEqual(copy);
  });
});

describe("cardCounts", () => {
  it("counts from the whole set", () => {
    expect(cardCounts(cards)).toEqual({ all: 3, white: 2, black: 1, inactive: 1 });
  });
});
