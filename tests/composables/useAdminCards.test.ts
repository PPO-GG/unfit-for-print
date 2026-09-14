import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));
vi.mock("~/composables/useNotifications", () => ({ useNotifications: () => ({ notify: vi.fn() }) }));

import { useAdminCards } from "~/composables/useAdminCards";

// Block body, not `() => fetchMock.mockReset()`: mockReset() returns the mock
// itself for chaining, and Vitest treats a value returned from beforeEach as
// an implicit afterEach cleanup — which would re-invoke fetchMock with no
// arguments after every test.
beforeEach(() => {
  fetchMock.mockReset();
});

describe("useAdminCards", () => {
  it("requests both tables for the selected packs and tags each row", async () => {
    fetchMock.mockImplementation((_u: string, opts: { query: { type: string } }) =>
      Promise.resolve(
        opts.query.type === "white"
          ? [{ id: "w1", text: "w", packId: "p1", pack: "Base", active: true }]
          : [{ id: "b1", text: "b", packId: "p1", pack: "Base", active: false, pick: 2 }],
      ),
    );
    const list = useAdminCards();
    await list.load(["p1", "p2"]);

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/cards/list", { query: { type: "white", packs: "p1,p2" } });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/cards/list", { query: { type: "black", packs: "p1,p2" } });
    expect(list.cards.value.map((c) => [c.id, c.type])).toEqual([["w1", "white"], ["b1", "black"]]);
  });

  it("omits the packs param when no pack is selected", async () => {
    fetchMock.mockResolvedValue([]);
    await useAdminCards().load([]);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/cards/list", { query: { type: "white" } });
  });

  it("ignores a slower earlier response", async () => {
    const pending: ((rows: unknown[]) => void)[] = [];
    fetchMock.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const list = useAdminCards();

    const first = list.load(["p1"]);
    const second = list.load(["p2"]);
    // Resolve the second load's two requests first, then the stale first load's.
    pending[2]!([{ id: "new", text: "n", packId: "p2", pack: "B", active: true }]);
    pending[3]!([]);
    await second;
    pending[0]!([{ id: "old", text: "o", packId: "p1", pack: "A", active: true }]);
    pending[1]!([]);
    await first;

    expect(list.cards.value.map((c) => c.id)).toEqual(["new"]);
  });
});
