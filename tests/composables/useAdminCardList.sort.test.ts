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
