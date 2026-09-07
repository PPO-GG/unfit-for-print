import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

const fetchMock = vi.fn();
const notifyMock = vi.fn();
const confirmMock = vi.fn();
const cardTypeRef = ref("white");

vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));
vi.mock("~/composables/useNotifications", () => ({
  useNotifications: () => ({ notify: notifyMock }),
}));
vi.mock("~/composables/useConfirm", () => ({
  useConfirm: () => ({ confirm: confirmMock }),
}));
vi.mock("~/composables/useCardSearch", () => ({
  useCardSearch: () => ({
    cardType: cardTypeRef,
    selectedPack: ref<string | undefined>("Source"),
    searchTerm: ref(""),
  }),
}));

import { useAdminCardMutations } from "~/composables/useAdminCardMutations";

function makeList() {
  return {
    cards: ref([
      { id: "a", text: "a", pack: "Source", active: true, type: "white" },
      { id: "b", text: "b", pack: "Source", active: false, type: "white" },
    ]),
    totalCards: ref(2),
    selectedCardIds: ref<string[]>([]),
    clearCardSelection: vi.fn(),
    invalidateCache: vi.fn(),
    clearList: vi.fn(),
    removeCard: vi.fn(),
    prependCard: vi.fn(),
    applyCardUpdate: vi.fn(),
    setActiveForPack: vi.fn(),
  } as any;
}

function makePacks() {
  return {
    packStats: ref<Record<string, unknown>>({}),
    packMeta: ref<Record<string, unknown>>({}),
    defaultPacks: ref<string[]>([]),
    selectedPacks: ref<string[]>([]),
    applyCardsMoved: vi.fn(),
    applyWholePackMoved: vi.fn(),
    applyCardCreated: vi.fn(),
    applyCardDeleted: vi.fn(),
    applyCardToggled: vi.fn(),
    applyPackToggled: vi.fn(),
    applyPackTypeCleared: vi.fn(),
    forgetPack: vi.fn(),
    clearPackSelection: vi.fn(),
    cardCountFor: vi.fn(() => 5),
  } as any;
}

beforeEach(() => {
  fetchMock.mockReset();
  notifyMock.mockReset();
  confirmMock.mockReset();
  confirmMock.mockResolvedValue(true);
  cardTypeRef.value = "white";
});

describe("moveSelectedCards", () => {
  it("posts the selected ids and the current card type", async () => {
    const list = makeList();
    const packs = makePacks();
    list.selectedCardIds.value = ["a", "b"];
    fetchMock.mockResolvedValue({ moved: { white: 2, black: 0 }, aux: null });

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.moveSelectedCards("Target");

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/cards/move", {
      method: "POST",
      body: { from: { ids: ["a", "b"] }, toPack: "Target", type: "white" },
    });
  });

  it("reports the moved cards' active count to the stat mirror", async () => {
    const list = makeList();
    const packs = makePacks();
    list.selectedCardIds.value = ["a", "b"]; // one active, one not
    fetchMock.mockResolvedValue({ moved: { white: 2, black: 0 }, aux: null });

    const m = useAdminCardMutations({ list, packs });
    await m.moveSelectedCards("Target");

    expect(packs.applyCardsMoved).toHaveBeenCalledWith("Source", "Target", "white", 2, 1);
  });

  it("clears the selection after a successful move", async () => {
    const list = makeList();
    const packs = makePacks();
    list.selectedCardIds.value = ["a"];
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 }, aux: null });

    const m = useAdminCardMutations({ list, packs });
    await m.moveSelectedCards("Target");

    expect(list.clearCardSelection).toHaveBeenCalled();
  });

  it("does nothing when nothing is selected", async () => {
    const list = makeList();
    const packs = makePacks();

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.moveSelectedCards("Target");

    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports failure without touching the stat mirror", async () => {
    const list = makeList();
    const packs = makePacks();
    list.selectedCardIds.value = ["a"];
    fetchMock.mockRejectedValue(new Error("boom"));

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.moveSelectedCards("Target");

    expect(ok).toBe(false);
    expect(packs.applyCardsMoved).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ color: "error" }),
    );
  });

  it("drops moved cards from a pack-filtered grid, since they no longer match it", async () => {
    const list = makeList();
    const packs = makePacks();
    list.selectedCardIds.value = ["a"];
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 }, aux: null });

    const m = useAdminCardMutations({ list, packs });
    await m.moveSelectedCards("Target");

    expect(list.cards.value.map((c: { id: string }) => c.id)).toEqual(["b"]);
    expect(list.totalCards.value).toBe(1);
  });

  it("splits a selection larger than the server's cap into sequential requests", async () => {
    const list = makeList();
    const packs = makePacks();
    const ids = Array.from({ length: 1200 }, (_, i) => `id-${i}`);
    list.cards.value = ids.map((id) => ({ id, text: id, pack: "Source", active: true, type: "white" }));
    list.selectedCardIds.value = [...ids];
    fetchMock
      .mockResolvedValueOnce({ moved: { white: 500, black: 0 }, aux: null })
      .mockResolvedValueOnce({ moved: { white: 500, black: 0 }, aux: null })
      .mockResolvedValueOnce({ moved: { white: 200, black: 0 }, aux: null });

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.moveSelectedCards("Target");

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const sent = fetchMock.mock.calls.map((c) => c[1].body.from.ids.length);
    expect(sent).toEqual([500, 500, 200]);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringMatching(/1200 cards/) }),
    );
  });

  it("mirrors only the chunks that completed when a later one fails", async () => {
    const list = makeList();
    const packs = makePacks();
    const ids = Array.from({ length: 1200 }, (_, i) => `id-${i}`);
    list.cards.value = ids.map((id) => ({ id, text: id, pack: "Source", active: true, type: "white" }));
    list.selectedCardIds.value = [...ids];
    fetchMock
      .mockResolvedValueOnce({ moved: { white: 500, black: 0 }, aux: null })
      .mockRejectedValueOnce(new Error("boom"));

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.moveSelectedCards("Target");

    expect(ok).toBe(false);
    expect(packs.applyCardsMoved).toHaveBeenCalledTimes(1);
    expect(packs.applyCardsMoved).toHaveBeenCalledWith("Source", "Target", "white", 500, 500);
    expect(list.selectedCardIds.value).toHaveLength(700);
    expect(list.selectedCardIds.value[0]).toBe("id-500");
    expect(list.cards.value).toHaveLength(700);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "error",
        description: expect.stringMatching(/500 of 1200/),
      }),
    );
  });

  it("debits each source pack separately when a search spans packs", async () => {
    const list = makeList();
    const packs = makePacks();
    list.cards.value = [
      { id: "a", text: "a", pack: "Alpha", active: true, type: "white" },
      { id: "b", text: "b", pack: "Beta", active: true, type: "white" },
      { id: "c", text: "c", pack: "Alpha", active: false, type: "white" },
    ];
    list.selectedCardIds.value = ["a", "b", "c"];
    fetchMock.mockResolvedValue({ moved: { white: 3, black: 0 }, aux: null });

    const m = useAdminCardMutations({ list, packs });
    await m.moveSelectedCards("Target");

    expect(packs.applyCardsMoved).toHaveBeenCalledTimes(2);
    expect(packs.applyCardsMoved).toHaveBeenCalledWith("Alpha", "Target", "white", 2, 1);
    expect(packs.applyCardsMoved).toHaveBeenCalledWith("Beta", "Target", "white", 1, 1);
  });
});

describe("moveSelectedCards — mixed card types", () => {
  it("splits a cross-type selection into one request per type", async () => {
    const list = makeList();
    const packs = makePacks();
    list.cards.value = [
      { id: "w1", text: "w", pack: "Source", active: true, type: "white" },
      { id: "b1", text: "b", pack: "Source", active: true, type: "black" },
    ];
    list.selectedCardIds.value = ["w1", "b1"];
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 }, aux: null });

    const m = useAdminCardMutations({ list, packs });
    await m.moveSelectedCards("Target");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const types = fetchMock.mock.calls.map((c) => c[1].body.type).sort();
    expect(types).toEqual(["black", "white"]);
    // never "all" — the route 400s on it for id moves
    expect(types).not.toContain("all");
  });

  it("mirrors each type separately so the sidebar counts stay right", async () => {
    const list = makeList();
    const packs = makePacks();
    list.cards.value = [
      { id: "w1", text: "w", pack: "Source", active: true, type: "white" },
      { id: "b1", text: "b", pack: "Source", active: false, type: "black" },
    ];
    list.selectedCardIds.value = ["w1", "b1"];
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 }, aux: null });

    const m = useAdminCardMutations({ list, packs });
    await m.moveSelectedCards("Target");

    expect(packs.applyCardsMoved).toHaveBeenCalledWith("Source", "Target", "white", 1, 1);
    expect(packs.applyCardsMoved).toHaveBeenCalledWith("Source", "Target", "black", 1, 0);
  });
});

describe("renamePack", () => {
  it("confirms, posts the whole-pack move, and re-keys the mirror", async () => {
    const list = makeList();
    const packs = makePacks();
    fetchMock.mockResolvedValue({ moved: { white: 3, black: 1 }, aux: "move" });

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.renamePack("Old", "New");

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/cards/move", {
      method: "POST",
      body: { from: { pack: "Old" }, toPack: "New", type: "all" },
    });
    expect(packs.applyWholePackMoved).toHaveBeenCalledWith("Old", "New", "move");
  });

  it("uses the server's verdict when the target already exists", async () => {
    const list = makeList();
    const packs = makePacks();
    packs.packStats.value = { New: { name: "New" } };
    fetchMock.mockResolvedValue({ moved: { white: 3, black: 1 }, aux: "drop" });

    const m = useAdminCardMutations({ list, packs });
    await m.renamePack("Old", "New");

    expect(packs.applyWholePackMoved).toHaveBeenCalledWith("Old", "New", "drop");
  });

  // The rename dialog IS the confirmation: the admin typed a name and pressed
  // the action button. Stacking useConfirm's global modal on top of the open
  // one buried it under a second backdrop blur.
  it("does not stack a second dialog on top of the rename modal", async () => {
    const list = makeList();
    const packs = makePacks();
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 }, aux: null });

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.renamePack("Old", "New");

    expect(ok).toBe(true);
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("refuses a blank new name without calling the server", async () => {
    const list = makeList();
    const packs = makePacks();

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.renamePack("Old", "   ");

    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("mergePacks", () => {
  it("posts one move per source and folds them into the target", async () => {
    const list = makeList();
    const packs = makePacks();
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 }, aux: null });

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.mergePacks(["A", "B"], "Target");

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/cards/move", {
      method: "POST",
      body: { from: { pack: "A" }, toPack: "Target", type: "all" },
    });
    expect(packs.applyWholePackMoved).toHaveBeenCalledWith("A", "Target", null);
    expect(packs.applyWholePackMoved).toHaveBeenCalledWith("B", "Target", null);
  });

  it("does not stack a second dialog on top of the merge modal", async () => {
    const list = makeList();
    const packs = makePacks();
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 }, aux: null });

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.mergePacks(["A"], "Target");

    expect(ok).toBe(true);
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("skips a source that is also the target", async () => {
    const list = makeList();
    const packs = makePacks();
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 }, aux: null });

    const m = useAdminCardMutations({ list, packs });
    await m.mergePacks(["A", "Target"], "Target");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("mirrors the sources that did merge when a later request fails", async () => {
    const list = makeList();
    const packs = makePacks();
    list.cards.value = [
      { id: "a", text: "a", pack: "A", active: true },
      { id: "b", text: "b", pack: "B", active: true },
    ];
    fetchMock
      .mockResolvedValueOnce({ moved: { white: 1, black: 0 }, aux: "move" })
      .mockRejectedValueOnce(new Error("boom"));

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.mergePacks(["A", "B"], "Target");

    expect(ok).toBe(false);
    expect(list.invalidateCache).toHaveBeenCalled();
    expect(packs.applyWholePackMoved).toHaveBeenCalledTimes(1);
    expect(packs.applyWholePackMoved).toHaveBeenCalledWith("A", "Target", "move");
    expect(list.cards.value.find((c: { id: string }) => c.id === "a")?.pack).toBe("Target");
    expect(list.cards.value.find((c: { id: string }) => c.id === "b")?.pack).toBe("B");
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ color: "error", description: expect.stringMatching(/1 of 2/) }),
    );
  });
});

describe("moveCard", () => {
  it("moves a single card by id, using the card's own type", async () => {
    const list = makeList();
    const packs = makePacks();
    const card = list.cards.value[0]!; // id "a", pack "Source", type "white", active true
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 }, aux: null });

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.moveCard(card, "Target");

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/cards/move", {
      method: "POST",
      body: { from: { ids: ["a"] }, toPack: "Target", type: "white" },
    });
    expect(card.pack).toBe("Target");
    expect(packs.applyCardsMoved).toHaveBeenCalledWith("Source", "Target", "white", 1, 1);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ color: "success" }),
    );
  });

  it("no-ops when the target equals the card's current pack", async () => {
    const list = makeList();
    const packs = makePacks();
    const card = list.cards.value[0]!;

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.moveCard(card, "Source");

    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("reports failure and leaves the card's pack unchanged", async () => {
    const list = makeList();
    const packs = makePacks();
    const card = list.cards.value[0]!;
    fetchMock.mockRejectedValue(new Error("boom"));

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.moveCard(card, "Target");

    expect(ok).toBe(false);
    expect(card.pack).toBe("Source");
    expect(packs.applyCardsMoved).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ color: "error" }),
    );
  });
});

describe("deleteSelectedCards", () => {
  it("emits one honest summary toast when every delete succeeds", async () => {
    const list = makeList();
    const packs = makePacks();
    list.selectedCardIds.value = ["a", "b"];
    fetchMock.mockResolvedValue({});

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.deleteSelectedCards();

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "success",
        description: expect.stringMatching(/2 cards/),
      }),
    );
  });

  it("reports an honest partial count in one toast when some deletes fail", async () => {
    const list = makeList();
    const packs = makePacks();
    list.selectedCardIds.value = ["a", "b"];
    fetchMock.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("boom"));

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.deleteSelectedCards();

    expect(ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "error",
        description: expect.stringMatching(/1 of 2/),
      }),
    );
  });

  it("aborts after 5 consecutive failures and reports what was deleted before stopping", async () => {
    const list = makeList();
    const packs = makePacks();
    const ids = Array.from({ length: 10 }, (_, i) => `id-${i}`);
    list.cards.value = ids.map((id) => ({
      id,
      text: id,
      pack: "Source",
      active: true,
      type: "white",
    }));
    list.selectedCardIds.value = [...ids];
    fetchMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockRejectedValue(new Error("boom"));

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.deleteSelectedCards();

    expect(ok).toBe(false);
    // 2 successes, then 5 consecutive failures trip the abort — 7 attempts,
    // not all 10.
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "error",
        description: expect.stringMatching(/2 of 10/),
      }),
    );
  });

  it("does nothing when nothing is selected", async () => {
    const list = makeList();
    const packs = makePacks();

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.deleteSelectedCards();

    expect(ok).toBe(false);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when the confirmation is declined", async () => {
    const list = makeList();
    const packs = makePacks();
    list.selectedCardIds.value = ["a"];
    confirmMock.mockResolvedValue(false);

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.deleteSelectedCards();

    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });
});

describe("single-card actions while browsing All", () => {
  it("toggles using the card's own type, never the ambient filter", async () => {
    const list = makeList();
    const packs = makePacks();
    cardTypeRef.value = "all";
    fetchMock.mockResolvedValue({ active: false });

    const m = useAdminCardMutations({ list, packs });
    await m.toggleCardActive({ id: "b1", text: "b", pack: "Source", active: true, type: "black" } as never);

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/cards/toggle", {
      method: "POST",
      body: { id: "b1", type: "black" },
    });
    expect(packs.applyCardToggled).toHaveBeenCalledWith("Source", "black", false);
  });

  it("deletes using the card's own type, never the ambient filter", async () => {
    const list = makeList();
    const packs = makePacks();
    cardTypeRef.value = "all";
    fetchMock.mockResolvedValue({});

    const m = useAdminCardMutations({ list, packs });
    await m.deleteCard({ id: "w1", text: "w", pack: "Source", active: true, type: "white" } as never);

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/cards/delete", {
      method: "POST",
      body: { id: "w1", type: "white" },
    });
    expect(packs.applyCardDeleted).toHaveBeenCalledWith("Source", "white", true);
  });
});
