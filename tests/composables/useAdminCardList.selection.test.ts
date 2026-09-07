// Card selection is what makes "move these cards to another pack" possible.
// It lives beside the card list rather than in the page so it can be dropped
// the moment the query changes — a selection carried across a filter change
// would apply a move to cards the admin can no longer see.
import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));

import { useAdminCardList } from "~/composables/useAdminCardList";

function seedCards(list: ReturnType<typeof useAdminCardList>, ids: string[]) {
  list.cards.value = ids.map((id) => ({ id, text: `card ${id}` }));
  list.visibleCards.value = [...list.cards.value];
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("useAdminCardList — selection", () => {
  it("starts with nothing selected", () => {
    const list = useAdminCardList();
    expect(list.selectedCardIds.value).toEqual([]);
  });

  it("toggles a card in and back out of the selection", () => {
    const list = useAdminCardList();
    seedCards(list, ["a", "b"]);

    list.toggleCardSelected("a");
    expect(list.isCardSelected("a")).toBe(true);
    expect(list.selectedCardIds.value).toEqual(["a"]);

    list.toggleCardSelected("a");
    expect(list.isCardSelected("a")).toBe(false);
    expect(list.selectedCardIds.value).toEqual([]);
  });

  it("selects an inclusive range from the last clicked card", () => {
    const list = useAdminCardList();
    seedCards(list, ["a", "b", "c", "d", "e"]);

    list.toggleCardSelected("b");
    list.selectCardRangeTo("d");

    expect(list.selectedCardIds.value.sort()).toEqual(["b", "c", "d"]);
  });

  it("selects a backwards range just as well", () => {
    const list = useAdminCardList();
    seedCards(list, ["a", "b", "c", "d", "e"]);

    list.toggleCardSelected("d");
    list.selectCardRangeTo("b");

    expect(list.selectedCardIds.value.sort()).toEqual(["b", "c", "d"]);
  });

  it("falls back to a plain toggle when no anchor has been set", () => {
    const list = useAdminCardList();
    seedCards(list, ["a", "b", "c"]);

    list.selectCardRangeTo("b");

    expect(list.selectedCardIds.value).toEqual(["b"]);
  });

  it("selects every loaded card, not just the visible page", () => {
    const list = useAdminCardList();
    list.cards.value = ["a", "b", "c", "d"].map((id) => ({ id, text: id }));
    list.visibleCards.value = list.cards.value.slice(0, 2);

    list.selectAllLoaded();

    expect(list.selectedCardIds.value.sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("clears the selection on demand", () => {
    const list = useAdminCardList();
    seedCards(list, ["a", "b"]);
    list.selectAllLoaded();

    list.clearCardSelection();

    expect(list.selectedCardIds.value).toEqual([]);
  });

  it("drops the selection when the list is cleared", () => {
    const list = useAdminCardList();
    seedCards(list, ["a", "b"]);
    list.selectAllLoaded();

    list.clearList();

    expect(list.selectedCardIds.value).toEqual([]);
  });

  it("drops a selected id that is no longer in the list", () => {
    const list = useAdminCardList();
    seedCards(list, ["a", "b"]);
    list.selectAllLoaded();

    list.removeCard("a");

    expect(list.selectedCardIds.value).toEqual(["b"]);
  });
});
