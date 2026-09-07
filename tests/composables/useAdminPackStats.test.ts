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

describe("useAdminPackStats — moving cards between packs", () => {
  it("moves totals and actives from the source pack to the target", () => {
    const packs = useAdminPackStats();
    seed(packs, {
      Source: { white: [10, 8] },
      Target: { white: [2, 2] },
    });

    packs.applyCardsMoved("Source", "Target", "white", 3, 2);

    expect(packs.packStats.value.Source.white).toEqual({ total: 7, active: 6 });
    expect(packs.packStats.value.Target.white).toEqual({ total: 5, active: 4 });
  });

  it("creates the target pack when it did not exist yet", () => {
    const packs = useAdminPackStats();
    seed(packs, { Source: { white: [4, 4] } });

    packs.applyCardsMoved("Source", "Brand New", "white", 2, 2);

    expect(packs.packStats.value["Brand New"].white).toEqual({ total: 2, active: 2 });
    expect(packs.packStats.value["Brand New"].black).toEqual({ total: 0, active: 0 });
  });

  it("forgets the source pack once its last card leaves", () => {
    const packs = useAdminPackStats();
    seed(packs, { Source: { white: [2, 2] }, Target: { white: [1, 1] } });

    packs.applyCardsMoved("Source", "Target", "white", 2, 2);

    expect(packs.packStats.value.Source).toBeUndefined();
    expect(packs.packStats.value.Target.white).toEqual({ total: 3, active: 3 });
  });

  it("keeps the source pack when it still holds the other card type", () => {
    const packs = useAdminPackStats();
    seed(packs, { Mixed: { white: [2, 2], black: [1, 1] } });

    packs.applyCardsMoved("Mixed", "Elsewhere", "white", 2, 2);

    expect(packs.packStats.value.Mixed.white).toEqual({ total: 0, active: 0 });
    expect(packs.packStats.value.Mixed.black).toEqual({ total: 1, active: 1 });
  });
});

describe("useAdminPackStats — whole-pack moves", () => {
  it("folds the counts into the target and forgets the source on a rename", () => {
    const packs = useAdminPackStats();
    seed(packs, { Old: { white: [10, 8], black: [3, 3] } });

    packs.applyWholePackMoved("Old", "New", "move");

    expect(packs.packStats.value.Old).toBeUndefined();
    expect(packs.packStats.value.New.white).toEqual({ total: 10, active: 8 });
    expect(packs.packStats.value.New.black).toEqual({ total: 3, active: 3 });
    expect(packs.packStats.value.New.name).toBe("New");
  });

  it("folds the counts into the target and forgets the source on a merge", () => {
    const packs = useAdminPackStats();
    seed(packs, {
      A: { white: [5, 4], black: [2, 2] },
      Target: { white: [1, 1], black: [1, 0] },
    });

    packs.applyWholePackMoved("A", "Target", "drop");

    expect(packs.packStats.value.A).toBeUndefined();
    expect(packs.packStats.value.Target.white).toEqual({ total: 6, active: 5 });
    expect(packs.packStats.value.Target.black).toEqual({ total: 3, active: 2 });
  });

  it("carries default status and metadata when the server says 'move'", () => {
    const packs = useAdminPackStats();
    seed(packs, { Old: { white: [1, 1] } });
    packs.defaultPacks.value = ["Old", "Other"];
    packs.packMeta.value = {
      Old: { pack: "Old", description: "travels" } as never,
    };

    packs.applyWholePackMoved("Old", "New", "move");

    expect(packs.defaultPacks.value.sort()).toEqual(["New", "Other"]);
    expect(packs.packMeta.value.Old).toBeUndefined();
    expect(packs.packMeta.value.New).toEqual({ pack: "New", description: "travels" });
  });

  it("discards the source's default status and metadata when the server says 'drop'", () => {
    const packs = useAdminPackStats();
    seed(packs, { A: { white: [1, 1] }, Target: { white: [1, 1] } });
    packs.defaultPacks.value = ["A"];
    packs.packMeta.value = {
      A: { pack: "A", description: "discarded" } as never,
      Target: { pack: "Target", description: "kept" } as never,
    };

    packs.applyWholePackMoved("A", "Target", "drop");

    expect(packs.defaultPacks.value).toEqual([]);
    expect(packs.packMeta.value.A).toBeUndefined();
    expect(packs.packMeta.value.Target).toEqual({ pack: "Target", description: "kept" });
  });

  it("never lets a 'move' source clobber metadata the target already has", () => {
    // Unreachable in practice — the server only says "move" when nothing was
    // at the target key — but the mirror must not lose the target's row if the
    // two ever disagree.
    const packs = useAdminPackStats();
    seed(packs, { A: { white: [1, 1] }, Target: { white: [1, 1] } });
    packs.packMeta.value = {
      A: { pack: "A", description: "source" } as never,
      Target: { pack: "Target", description: "target" } as never,
    };

    packs.applyWholePackMoved("A", "Target", "move");

    expect(packs.packMeta.value.Target).toEqual({
      pack: "Target",
      description: "target",
    });
  });

  it("leaves the source's default status and metadata alone when the server says 'leave'", () => {
    const packs = useAdminPackStats();
    seed(packs, { Mixed: { white: [2, 2], black: [1, 1] }, Target: { white: [1, 1] } });
    packs.defaultPacks.value = ["Mixed"];
    packs.packMeta.value = {
      Mixed: { pack: "Mixed", description: "still here" } as never,
    };

    packs.applyWholePackMoved("Mixed", "Target", "leave");

    expect(packs.defaultPacks.value).toEqual(["Mixed"]);
    expect(packs.packMeta.value.Mixed).toEqual({
      pack: "Mixed",
      description: "still here",
    });
    expect(packs.packStats.value.Mixed).toBeDefined();
    expect(packs.packStats.value.Target.white).toEqual({ total: 3, active: 3 });
  });

  it("ignores a move onto the pack's own name", () => {
    const packs = useAdminPackStats();
    seed(packs, { Target: { white: [4, 4] } });
    packs.defaultPacks.value = ["Target"];

    packs.applyWholePackMoved("Target", "Target", "move");

    expect(packs.packStats.value.Target.white).toEqual({ total: 4, active: 4 });
    expect(packs.defaultPacks.value).toEqual(["Target"]);
  });
});
