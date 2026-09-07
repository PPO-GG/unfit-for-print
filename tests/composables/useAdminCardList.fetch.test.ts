// The "All" filter is the one place the client has to do something the server
// cannot: /api/admin/cards/list queries a single table, so All means two
// requests merged locally, and every row has to carry its own type because
// page state can no longer say what it is.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));

const cardType = ref<"all" | "white" | "black">("white");
const selectedPack = ref<string | undefined>("Base");
const searchTerm = ref("");
vi.mock("~/composables/useCardSearch", () => ({
  useCardSearch: () => ({ cardType, selectedPack, searchTerm }),
}));

import { useAdminCardList } from "~/composables/useAdminCardList";

beforeEach(() => {
  fetchMock.mockReset();
  cardType.value = "white";
  selectedPack.value = "Base";
  searchTerm.value = "";
});

describe("useAdminCardList — fetching", () => {
  it("issues one request and tags the rows for a single type", async () => {
    fetchMock.mockResolvedValue([{ id: "w1", text: "w" }]);

    const list = useAdminCardList();
    await list.fetchCards();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/cards/list", {
      query: { type: "white", pack: "Base" },
    });
    expect(list.cards.value).toEqual([{ id: "w1", text: "w", type: "white" }]);
  });

  it("issues two requests for All and tags each row with its own type", async () => {
    cardType.value = "all";
    fetchMock.mockImplementation((_url: string, opts: any) =>
      Promise.resolve(
        opts.query.type === "white"
          ? [{ id: "w1", text: "w" }]
          : [{ id: "b1", text: "b", pick: 2 }],
      ),
    );

    const list = useAdminCardList();
    await list.fetchCards();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(list.cards.value).toHaveLength(2);
    expect(list.cards.value.find((c) => c.id === "w1")!.type).toBe("white");
    expect(list.cards.value.find((c) => c.id === "b1")!.type).toBe("black");
  });

  it("does not send the pick filter when browsing All", async () => {
    cardType.value = "all";
    fetchMock.mockResolvedValue([]);

    const list = useAdminCardList();
    list.numPick.value = 2;
    await list.fetchCards();

    for (const call of fetchMock.mock.calls) {
      expect(call[1].query.pick).toBeUndefined();
    }
  });

  it("caches All separately from the single-type queries", async () => {
    fetchMock.mockResolvedValue([{ id: "w1", text: "w" }]);
    const list = useAdminCardList();

    await list.fetchCards();
    cardType.value = "all";
    await list.fetchCards();

    // 1 for white + 2 for all = 3; a shared cache key would have skipped one.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("omits an empty pack from the query so All-packs browsing works", async () => {
    selectedPack.value = undefined;
    fetchMock.mockResolvedValue([]);

    const list = useAdminCardList();
    await list.fetchCards();

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/cards/list", {
      query: { type: "white" },
    });
  });
});
