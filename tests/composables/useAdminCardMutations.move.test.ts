import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

const fetchMock = vi.fn();
const notifyMock = vi.fn();
const confirmMock = vi.fn();

vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));
vi.mock("~/composables/useNotifications", () => ({
  useNotifications: () => ({ notify: notifyMock }),
}));
vi.mock("~/composables/useConfirm", () => ({
  useConfirm: () => ({ confirm: confirmMock }),
}));
vi.mock("~/composables/useCardSearch", () => ({
  useCardSearch: () => ({
    cardType: ref("white"),
    selectedPack: ref<string | undefined>("Source"),
    searchTerm: ref(""),
  }),
}));

import { useAdminCardMutations } from "~/composables/useAdminCardMutations";

function makeList() {
  return {
    cards: ref([
      { id: "a", text: "a", pack: "Source", active: true },
      { id: "b", text: "b", pack: "Source", active: false },
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
    selectedPacks: ref<string[]>([]),
    applyCardsMoved: vi.fn(),
    applyPackRenamed: vi.fn(),
    applyPacksMerged: vi.fn(),
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
});

describe("moveSelectedCards", () => {
  it("posts the selected ids and the current card type", async () => {
    const list = makeList();
    const packs = makePacks();
    list.selectedCardIds.value = ["a", "b"];
    fetchMock.mockResolvedValue({ moved: { white: 2, black: 0 } });

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
    fetchMock.mockResolvedValue({ moved: { white: 2, black: 0 } });

    const m = useAdminCardMutations({ list, packs });
    await m.moveSelectedCards("Target");

    expect(packs.applyCardsMoved).toHaveBeenCalledWith("Source", "Target", "white", 2, 1);
  });

  it("clears the selection after a successful move", async () => {
    const list = makeList();
    const packs = makePacks();
    list.selectedCardIds.value = ["a"];
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 } });

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
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 } });

    const m = useAdminCardMutations({ list, packs });
    await m.moveSelectedCards("Target");

    expect(list.cards.value.map((c: { id: string }) => c.id)).toEqual(["b"]);
    expect(list.totalCards.value).toBe(1);
  });
});

describe("renamePack", () => {
  it("confirms, posts the whole-pack move, and re-keys the mirror", async () => {
    const list = makeList();
    const packs = makePacks();
    fetchMock.mockResolvedValue({ moved: { white: 3, black: 1 } });

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.renamePack("Old", "New");

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/cards/move", {
      method: "POST",
      body: { from: { pack: "Old" }, toPack: "New", type: "all" },
    });
    expect(packs.applyPackRenamed).toHaveBeenCalledWith("Old", "New");
  });

  it("warns that in-progress lobbies lose the pack from their selection", async () => {
    const list = makeList();
    const packs = makePacks();
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 } });

    const m = useAdminCardMutations({ list, packs });
    await m.renamePack("Old", "New");

    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/in progress/i) }),
    );
  });

  it("does nothing when the confirm is declined", async () => {
    const list = makeList();
    const packs = makePacks();
    confirmMock.mockResolvedValue(false);

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.renamePack("Old", "New");

    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
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
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 } });

    const m = useAdminCardMutations({ list, packs });
    const ok = await m.mergePacks(["A", "B"], "Target");

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/cards/move", {
      method: "POST",
      body: { from: { pack: "A" }, toPack: "Target", type: "all" },
    });
    expect(packs.applyPacksMerged).toHaveBeenCalledWith(["A", "B"], "Target");
  });

  it("tells the admin the target's metadata wins", async () => {
    const list = makeList();
    const packs = makePacks();
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 } });

    const m = useAdminCardMutations({ list, packs });
    await m.mergePacks(["A"], "Target");

    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/Target/) }),
    );
  });

  it("skips a source that is also the target", async () => {
    const list = makeList();
    const packs = makePacks();
    fetchMock.mockResolvedValue({ moved: { white: 1, black: 0 } });

    const m = useAdminCardMutations({ list, packs });
    await m.mergePacks(["A", "Target"], "Target");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
