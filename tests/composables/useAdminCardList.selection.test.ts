// Card selection is what makes "move these cards to another pack" possible.
// It lives beside the card list rather than in the page so it can be dropped
// the moment the query changes — a selection carried across a filter change
// would apply a move to cards the admin can no longer see.
import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));

import { useAdminCardList } from "~/composables/useAdminCardList";

function seedCards(list: ReturnType<typeof useAdminCardList>, ids: string[]) {
  list.cards.value = ids.map((id) => ({ id, text: `card ${id}`, type: "white" }));
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

  it("ranges over the order it is given, not the whole loaded set", () => {
    const list = useAdminCardList();
    seedCards(list, ["a", "b", "c", "d", "e"]);
    // What the chip leaves on screen: b, d, e — c is filtered away.
    const visible = ["b", "d", "e"];

    list.toggleCardSelected("b");
    list.selectCardRangeTo("e", visible);

    expect(list.selectedCardIds.value.sort()).toEqual(["b", "d", "e"]);
  });

  it("falls back to a plain toggle when the anchor is not in the given order", () => {
    const list = useAdminCardList();
    seedCards(list, ["a", "b", "c"]);

    list.toggleCardSelected("a");
    list.selectCardRangeTo("c", ["b", "c"]);

    expect(list.selectedCardIds.value.sort()).toEqual(["a", "c"]);
  });

  it("selectAllOf selects exactly the ids given and nothing else", () => {
    const list = useAdminCardList();
    seedCards(list, ["a", "b", "c", "d"]);

    list.selectAllOf(["b", "d"]);

    expect(list.selectedCardIds.value.sort()).toEqual(["b", "d"]);
    expect(list.isCardSelected("a")).toBe(false);
    expect(list.isCardSelected("c")).toBe(false);
  });

  it("selectAllOf replaces a previous selection rather than adding to it", () => {
    const list = useAdminCardList();
    seedCards(list, ["a", "b", "c"]);
    list.toggleCardSelected("a");

    list.selectAllOf(["c"]);

    expect(list.selectedCardIds.value).toEqual(["c"]);
  });

  it("selects every loaded card", () => {
    const list = useAdminCardList();
    seedCards(list, ["a", "b", "c", "d"]);

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
