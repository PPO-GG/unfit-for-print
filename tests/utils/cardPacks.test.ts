// tests/utils/cardPacks.test.ts
//
// Covers the pack-gallery rollup behind the Labs card browser: /api/cards/packs
// reports white and black stats separately, and the gallery needs one tile per
// pack combining both.
import { describe, it, expect } from "vitest";
import {
  buildPackGallery,
  filterAndSortPacks,
  pageForIndex,
  sortPackGallery,
  stepCardIndex,
  type PackTile,
} from "~/utils/cardPacks";

/** Minimal tile; only `pack` and `total` matter to the sort. */
function tile(pack: string, total: number): PackTile {
  return { pack, white: total, black: 0, total, isDefault: false };
}

describe("buildPackGallery", () => {
  it("combines a pack's white and black stats into a single tile", () => {
    const gallery = buildPackGallery(
      {
        white: [{ pack: "Base", total: 10, active: 8 }],
        black: [{ pack: "Base", total: 4, active: 3 }],
      },
      [],
    );

    expect(gallery).toEqual([
      { pack: "Base", white: 8, black: 3, total: 11, isDefault: false },
    ]);
  });

  it("counts a pack that only has one card type", () => {
    const gallery = buildPackGallery(
      { white: [{ pack: "Answers Only", total: 5, active: 5 }], black: [] },
      [],
    );

    expect(gallery).toEqual([
      { pack: "Answers Only", white: 5, black: 0, total: 5, isDefault: false },
    ]);
  });

  it("omits packs whose cards are all deactivated", () => {
    const gallery = buildPackGallery(
      {
        white: [
          { pack: "Retired", total: 6, active: 0 },
          { pack: "Live", total: 2, active: 2 },
        ],
        black: [{ pack: "Retired", total: 3, active: 0 }],
      },
      [],
    );

    expect(gallery.map((tile) => tile.pack)).toEqual(["Live"]);
  });

  it("flags packs that are in the default lobby rotation", () => {
    const gallery = buildPackGallery(
      {
        white: [
          { pack: "Base", total: 1, active: 1 },
          { pack: "Extra", total: 1, active: 1 },
        ],
        black: [],
      },
      ["Base"],
    );

    expect(gallery.find((tile) => tile.pack === "Base")!.isDefault).toBe(true);
    expect(gallery.find((tile) => tile.pack === "Extra")!.isDefault).toBe(false);
  });

  it("sorts tiles by pack name so the gallery order is stable", () => {
    const gallery = buildPackGallery(
      {
        white: [
          { pack: "Zeta", total: 1, active: 1 },
          { pack: "alpha", total: 1, active: 1 },
          { pack: "Beta", total: 1, active: 1 },
        ],
        black: [],
      },
      [],
    );

    expect(gallery.map((tile) => tile.pack)).toEqual(["alpha", "Beta", "Zeta"]);
  });

  it("returns nothing when there are no packs at all", () => {
    expect(buildPackGallery({ white: [], black: [] }, [])).toEqual([]);
  });
});

describe("sortPackGallery", () => {
  it("orders the biggest packs first by default", () => {
    const sorted = sortPackGallery(
      [tile("Small", 10), tile("Huge", 1500), tile("Medium", 200)],
      "cards-desc",
    );

    expect(sorted.map((t) => t.pack)).toEqual(["Huge", "Medium", "Small"]);
  });

  it("orders the smallest packs first when asked", () => {
    const sorted = sortPackGallery(
      [tile("Small", 10), tile("Huge", 1500), tile("Medium", 200)],
      "cards-asc",
    );

    expect(sorted.map((t) => t.pack)).toEqual(["Small", "Medium", "Huge"]);
  });

  it("orders by pack name when sorting alphabetically", () => {
    const sorted = sortPackGallery(
      [tile("Zeta", 10), tile("alpha", 1500), tile("Beta", 200)],
      "name",
    );

    expect(sorted.map((t) => t.pack)).toEqual(["alpha", "Beta", "Zeta"]);
  });

  it("breaks card-count ties on pack name so the order is stable", () => {
    const sorted = sortPackGallery(
      [tile("Charlie", 50), tile("alpha", 50), tile("Bravo", 50)],
      "cards-desc",
    );

    expect(sorted.map((t) => t.pack)).toEqual(["alpha", "Bravo", "Charlie"]);
  });

  it("sorts totals numerically rather than as strings", () => {
    const sorted = sortPackGallery(
      [tile("Nine", 9), tile("Eighty", 80), tile("Hundred", 100)],
      "cards-desc",
    );

    expect(sorted.map((t) => t.pack)).toEqual(["Hundred", "Eighty", "Nine"]);
  });

  it("leaves the caller's array untouched", () => {
    const input = [tile("Small", 10), tile("Huge", 1500)];

    sortPackGallery(input, "cards-desc");

    expect(input.map((t) => t.pack)).toEqual(["Small", "Huge"]);
  });
});

describe("filterAndSortPacks", () => {
  const gallery = [
    { pack: "CAH Base Set", white: 1249, black: 261, total: 1510, isDefault: true },
    { pack: "Card Lab", white: 1193, black: 103, total: 1296, isDefault: false },
    { pack: "Blue Box", white: 100, black: 20, total: 120, isDefault: true },
  ];

  it("returns every pack, biggest first, with no filters applied", () => {
    const result = filterAndSortPacks(gallery, {
      search: "",
      defaultOnly: false,
      sort: "cards-desc",
    });

    expect(result.map((t) => t.pack)).toEqual([
      "CAH Base Set",
      "Card Lab",
      "Blue Box",
    ]);
  });

  it("keeps only default-rotation packs when defaultOnly is set", () => {
    const result = filterAndSortPacks(gallery, {
      search: "",
      defaultOnly: true,
      sort: "cards-desc",
    });

    expect(result.map((t) => t.pack)).toEqual(["CAH Base Set", "Blue Box"]);
  });

  it("matches the search against pack names case-insensitively", () => {
    const result = filterAndSortPacks(gallery, {
      search: "  CARD  ",
      defaultOnly: false,
      sort: "cards-desc",
    });

    expect(result.map((t) => t.pack)).toEqual(["Card Lab"]);
  });

  it("applies the search and the default-rotation filter together", () => {
    const result = filterAndSortPacks(gallery, {
      search: "ca",
      defaultOnly: true,
      sort: "cards-desc",
    });

    expect(result.map((t) => t.pack)).toEqual(["CAH Base Set"]);
  });

  it("sorts the filtered subset, not the whole gallery", () => {
    const result = filterAndSortPacks(gallery, {
      search: "",
      defaultOnly: true,
      sort: "cards-asc",
    });

    expect(result.map((t) => t.pack)).toEqual(["Blue Box", "CAH Base Set"]);
  });

  it("returns an empty list when nothing matches", () => {
    const result = filterAndSortPacks(gallery, {
      search: "nonexistent",
      defaultOnly: false,
      sort: "cards-desc",
    });

    expect(result).toEqual([]);
  });
});

describe("stepCardIndex", () => {
  it("moves forward through the page", () => {
    expect(stepCardIndex(0, 1, 24)).toBe(1);
  });

  it("moves backward through the page", () => {
    expect(stepCardIndex(5, -1, 24)).toBe(4);
  });

  it("wraps past the last card back to the first", () => {
    expect(stepCardIndex(23, 1, 24)).toBe(0);
  });

  it("wraps before the first card round to the last", () => {
    expect(stepCardIndex(0, -1, 24)).toBe(23);
  });

  it("stays put when the page holds a single card", () => {
    expect(stepCardIndex(0, 1, 1)).toBe(0);
    expect(stepCardIndex(0, -1, 1)).toBe(0);
  });

  it("returns a safe index for an empty page rather than NaN", () => {
    expect(stepCardIndex(0, 1, 0)).toBe(0);
  });

  it("handles a step larger than the page length", () => {
    expect(stepCardIndex(0, 30, 24)).toBe(6);
  });
});

describe("pageForIndex", () => {
  it("maps the first card to page one", () => {
    expect(pageForIndex(0, 24)).toEqual({ page: 1, offset: 0 });
  });

  it("maps the last card of a page to that same page", () => {
    expect(pageForIndex(23, 24)).toEqual({ page: 1, offset: 23 });
  });

  it("rolls over to the next page on the first card past the boundary", () => {
    expect(pageForIndex(24, 24)).toEqual({ page: 2, offset: 0 });
  });

  it("maps an index in the middle of a later page", () => {
    expect(pageForIndex(26, 24)).toEqual({ page: 2, offset: 2 });
  });

  it("maps a card deep into a large result set", () => {
    expect(pageForIndex(1248, 24)).toEqual({ page: 53, offset: 0 });
  });

  it("respects a different page size", () => {
    expect(pageForIndex(12, 10)).toEqual({ page: 2, offset: 2 });
  });

  it("falls back to the first card when the page size is not positive", () => {
    expect(pageForIndex(30, 0)).toEqual({ page: 1, offset: 0 });
  });

  it("treats a negative index as the first card", () => {
    expect(pageForIndex(-5, 24)).toEqual({ page: 1, offset: 0 });
  });
});
