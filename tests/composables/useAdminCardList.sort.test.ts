// Sorting is client-side because the whole result set is already in memory —
// the same property that lets "select all N" be honest.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));
vi.mock("~/composables/useCardSearch", () => ({
  useCardSearch: () => ({
    cardType: ref("white"),
    selectedPack: ref<string | undefined>("Base"),
    searchTerm: ref(""),
  }),
}));

import { useAdminCardList } from "~/composables/useAdminCardList";

function seed(list: ReturnType<typeof useAdminCardList>) {
  list.cards.value = [
    { id: "c", text: "Cherry", type: "white", timesPlayed: 5 },
    { id: "a", text: "apple", type: "white", timesPlayed: 90 },
    { id: "b", text: "Banana", type: "white", timesPlayed: 40 },
  ] as never;
}

beforeEach(() => fetchMock.mockReset());

describe("useAdminCardList — sorting", () => {
  it("defaults to pack order, leaving the server's order alone", () => {
    const list = useAdminCardList();
    seed(list);
    expect(list.sort.value).toBe("pack");
    expect(list.sortedCards.value.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts A-Z case-insensitively", () => {
    const list = useAdminCardList();
    seed(list);
    list.sort.value = "az";
    expect(list.sortedCards.value.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by most played and least played", () => {
    const list = useAdminCardList();
    seed(list);
    list.sort.value = "played-desc";
    expect(list.sortedCards.value.map((c) => c.id)).toEqual(["a", "b", "c"]);
    list.sort.value = "played-asc";
    expect(list.sortedCards.value.map((c) => c.id)).toEqual(["c", "b", "a"]);
  });

  it("treats a missing play count as zero rather than dropping the card", () => {
    const list = useAdminCardList();
    list.cards.value = [
      { id: "x", text: "x", type: "white" },
      { id: "y", text: "y", type: "white", timesPlayed: 3 },
    ] as never;
    list.sort.value = "played-desc";
    expect(list.sortedCards.value.map((c) => c.id)).toEqual(["y", "x"]);
  });

  it("never mutates the underlying cards array", () => {
    const list = useAdminCardList();
    seed(list);
    list.sort.value = "az";
    void list.sortedCards.value;
    expect(list.cards.value.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });
});

describe("useAdminCardList — rate sorting", () => {
  it("ranks by win rate and pushes under-played cards to the end", () => {
    const list = useAdminCardList();
    list.cards.value = [
      { id: "low", text: "l", type: "white", timesPlayed: 100, timesWon: 5 },
      { id: "high", text: "h", type: "white", timesPlayed: 100, timesWon: 40 },
      { id: "tiny", text: "t", type: "white", timesPlayed: 2, timesWon: 2 },
    ] as never;
    list.sort.value = "winrate-desc";
    expect(list.sortedCards.value.map((c) => c.id)).toEqual(["high", "low", "tiny"]);
  });

  it("ranks by skip rate the same way", () => {
    const list = useAdminCardList();
    list.cards.value = [
      { id: "ok", text: "o", type: "black", timesPlayed: 100, timesSkipped: 4 },
      { id: "bad", text: "b", type: "black", timesPlayed: 100, timesSkipped: 60 },
    ] as never;
    list.sort.value = "skiprate-desc";
    expect(list.sortedCards.value.map((c) => c.id)).toEqual(["bad", "ok"]);
  });
});
