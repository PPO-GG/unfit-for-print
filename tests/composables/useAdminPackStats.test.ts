// tests/composables/useAdminPackStats.test.ts
//
// packStats is a local mirror of server-side card counts: the admin card
// manager adjusts it in place after every mutation instead of re-fetching, so
// the sidebar stays responsive. The mirror used to be maintained by hand at
// eight call sites, each re-deriving "is this pack empty now?" slightly
// differently. These tests pin the consolidated rules.
import { describe, it, expect, vi, beforeEach } from "vitest";

// Nuxt auto-imports these into composables; the suite runs plain vitest.
const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));
vi.mock("~/composables/useNotifications", () => ({
  useNotifications: () => ({ notify: vi.fn() }),
}));

import { useAdminPackStats } from "~/composables/useAdminPackStats";

/** Seed the mirror without going through the network. */
function seed(
  packs: ReturnType<typeof useAdminPackStats>,
  stats: Record<string, { black?: [number, number]; white?: [number, number] }>,
) {
  const next: Record<string, any> = {};
  for (const [name, s] of Object.entries(stats)) {
    next[name] = {
      name,
      black: { total: s.black?.[0] ?? 0, active: s.black?.[1] ?? 0 },
      white: { total: s.white?.[0] ?? 0, active: s.white?.[1] ?? 0 },
    };
  }
  packs.packStats.value = next;
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("useAdminPackStats — loading", () => {
  it("merges the white and black roster into one entry per pack", async () => {
    fetchMock.mockResolvedValue({
      black: [{ pack: "Base", total: 10, active: 8 }],
      white: [
        { pack: "Base", total: 50, active: 50 },
        { pack: "Expansion", total: 20, active: 0 },
      ],
    });

    const packs = useAdminPackStats();
    await packs.loadPacks();

    expect(Object.keys(packs.packStats.value).sort()).toEqual([
      "Base",
      "Expansion",
    ]);
    expect(packs.packStats.value.Base).toEqual({
      name: "Base",
      black: { total: 10, active: 8 },
      white: { total: 50, active: 50 },
    });
    // A pack present in only one roster still gets zeroed counts for the other.
    expect(packs.packStats.value.Expansion!.black).toEqual({
      total: 0,
      active: 0,
    });
  });

  it("leaves the roster empty and does not throw when the request fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("boom"));

    const packs = useAdminPackStats();
    await packs.loadPacks();

    expect(packs.packStats.value).toEqual({});
    expect(packs.loadingPacks.value).toBe(false);
  });
});

describe("useAdminPackStats — sortedPacks", () => {
  it("sorts alphabetically and filters by the search term", () => {
    const packs = useAdminPackStats();
    seed(packs, { Zed: {}, apple: {}, Mango: {} });

    expect(packs.sortedPacks.value.map((p) => p.name)).toEqual([
      "apple",
      "Mango",
      "Zed",
    ]);

    packs.packSearchTerm.value = "  AN ";
    expect(packs.sortedPacks.value.map((p) => p.name)).toEqual(["Mango"]);
  });
});

describe("useAdminPackStats — stat mirror", () => {
  it("counts a created card and opens a new pack entry when needed", () => {
    const packs = useAdminPackStats();
    seed(packs, {});

    packs.applyCardCreated("Fresh", "white");

    expect(packs.packStats.value.Fresh).toEqual({
      name: "Fresh",
      black: { total: 0, active: 0 },
      white: { total: 1, active: 1 },
    });
  });

  it("files a card with no pack under the (no pack) bucket", () => {
    const packs = useAdminPackStats();
    seed(packs, {});

    packs.applyCardCreated(undefined, "black");

    expect(packs.packStats.value["(no pack)"]!.black).toEqual({
      total: 1,
      active: 1,
    });
  });

  it("decrements active only when the deleted card was active", () => {
    const packs = useAdminPackStats();
    seed(packs, { Base: { white: [5, 3] } });

    packs.applyCardDeleted("Base", "white", false);
    expect(packs.packStats.value.Base!.white).toEqual({ total: 4, active: 3 });

    packs.applyCardDeleted("Base", "white", true);
    expect(packs.packStats.value.Base!.white).toEqual({ total: 3, active: 2 });
  });

  it("keeps a pack that still has cards of the other type", () => {
    const packs = useAdminPackStats();
    seed(packs, { Base: { white: [1, 1], black: [2, 2] } });

    packs.applyCardDeleted("Base", "white", true);

    expect(packs.packStats.value.Base).toBeDefined();
    expect(packs.packStats.value.Base!.white.total).toBe(0);
  });

  it("forgets a pack once its last card of either type is gone", () => {
    const packs = useAdminPackStats();
    seed(packs, { Doomed: { white: [1, 1] } });
    packs.defaultPacks.value = ["Doomed", "Base"];
    packs.selectedPacks.value = ["Doomed"];

    packs.applyCardDeleted("Doomed", "white", true);

    expect(packs.packStats.value.Doomed).toBeUndefined();
    // The pack must also drop out of the default and bulk-selection lists —
    // leaving it in either was how a deleted pack kept haunting new lobbies.
    expect(packs.defaultPacks.value).toEqual(["Base"]);
    expect(packs.selectedPacks.value).toEqual([]);
  });

  it("moves active to 0 or total when a whole pack is toggled", () => {
    const packs = useAdminPackStats();
    seed(packs, { Base: { white: [50, 20], black: [10, 4] } });

    packs.applyPackToggled("Base", "white", true);
    expect(packs.packStats.value.Base!.white.active).toBe(50);
    expect(packs.packStats.value.Base!.black.active).toBe(4); // untouched

    packs.applyPackToggled("Base", "all", false);
    expect(packs.packStats.value.Base!.white.active).toBe(0);
    expect(packs.packStats.value.Base!.black.active).toBe(0);
  });

  it("zeroes one type on applyPackTypeCleared and forgets the pack if that emptied it", () => {
    const packs = useAdminPackStats();
    seed(packs, { Mixed: { white: [5, 5], black: [2, 2] } });
    packs.applyPackTypeCleared("Mixed", "black");
    expect(packs.packStats.value.Mixed!.black).toEqual({ total: 0, active: 0 });
    expect(packs.packStats.value.Mixed!.white.total).toBe(5);

    packs.applyPackTypeCleared("Mixed", "white");
    expect(packs.packStats.value.Mixed).toBeUndefined();
  });

  it("ignores adjustments for packs it has never heard of", () => {
    const packs = useAdminPackStats();
    seed(packs, {});

    expect(() => {
      packs.applyCardDeleted("Ghost", "white", true);
      packs.applyCardToggled("Ghost", "white", true);
      packs.applyPackToggled("Ghost", "all", true);
      packs.applyPackTypeCleared("Ghost", "black");
    }).not.toThrow();
    expect(packs.packStats.value).toEqual({});
  });

  it("sums both types for cardCountFor", () => {
    const packs = useAdminPackStats();
    seed(packs, { Base: { white: [50, 1], black: [10, 1] } });

    expect(packs.cardCountFor("Base")).toBe(60);
    expect(packs.cardCountFor("Missing")).toBe(0);
  });
});

describe("useAdminPackStats — bulk selection", () => {
  it("toggles a pack in and out of the selection", () => {
    const packs = useAdminPackStats();

    packs.togglePackSelection("Base");
    packs.togglePackSelection("Expansion");
    expect(packs.selectedPacks.value).toEqual(["Base", "Expansion"]);

    packs.togglePackSelection("Base");
    expect(packs.selectedPacks.value).toEqual(["Expansion"]);

    packs.clearPackSelection();
    expect(packs.selectedPacks.value).toEqual([]);
  });
});

describe("useAdminPackStats — typeStatDotClass", () => {
  it("colours by how much of the pack is active", () => {
    const packs = useAdminPackStats();

    expect(packs.typeStatDotClass({ total: 10, active: 0 })).toBe("bg-red-500");
    expect(packs.typeStatDotClass({ total: 10, active: 10 })).toBe(
      "bg-green-400",
    );
    expect(packs.typeStatDotClass({ total: 10, active: 4 })).toBe(
      "bg-yellow-400",
    );
  });
});
