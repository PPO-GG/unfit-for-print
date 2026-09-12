// tests/utils/cardPacks.test.ts
//
// Covers the pack-gallery rollup behind the Labs card browser: /api/cards/packs
// reports white and black stats separately, and the gallery needs one tile per
// pack combining both.
import { describe, it, expect } from "vitest";
import {
  buildPackGallery,
  pickRandomPacks,
  filterAndSortPacks,
  countLabsCards,
  isLabsPack,
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

  it("carries display name and series onto the tile when metadata exists", () => {
    // The Labs gallery rendered the raw pack key for its whole life, so the
    // same pack read "CAH Base Set" there and "Base Pack" in the admin rail.
    const gallery = buildPackGallery(
      {
        white: [{ pack: "CAH Base Set", total: 10, active: 8 }],
        black: [],
      },
      [],
      [{ pack: "CAH Base Set", displayName: "Base Pack", series: "Cards Against Humanity" }],
    );

    expect(gallery[0]).toMatchObject({
      pack: "CAH Base Set",
      displayName: "Base Pack",
      series: "Cards Against Humanity",
    });
  });

  it("leaves a tile's shape untouched when the pack has no metadata row", () => {
    // Most packs have no card_packs row at all, and a tile must not sprout
    // null fields the label helper would then have to special-case.
    const gallery = buildPackGallery(
      { white: [{ pack: "Unfit Labs", total: 5, active: 5 }], black: [] },
      [],
      [{ pack: "Something Else", displayName: "Nope", series: null }],
    );

    expect(gallery).toEqual([
      { pack: "Unfit Labs", white: 5, black: 0, total: 5, isDefault: false },
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

describe("filterAndSortPacks with labels", () => {
  // Search and A-Z both work off what the tile actually shows. Matching only
  // the raw key meant typing the name printed on the tile found nothing.
  const gallery = [
    {
      pack: "CAH Base Set",
      white: 1249,
      black: 261,
      total: 1510,
      isDefault: true,
      displayName: "Base Pack",
      series: "Cards Against Humanity",
    },
    { pack: "Zebra Pack", white: 10, black: 2, total: 12, isDefault: false },
  ];

  it("finds a pack by the display name shown on its tile", () => {
    const result = filterAndSortPacks(gallery, {
      search: "base pack",
      defaultOnly: false,
      sort: "cards-desc",
    });

    expect(result.map((t) => t.pack)).toEqual(["CAH Base Set"]);
  });

  it("still finds a pack by its raw key", () => {
    // The key stays searchable: it is what /api/cards/browse takes, and an
    // admin who knows it should not have to guess the label.
    const result = filterAndSortPacks(gallery, {
      search: "cah base",
      defaultOnly: false,
      sort: "cards-desc",
    });

    expect(result.map((t) => t.pack)).toEqual(["CAH Base Set"]);
  });

  it("sorts A-Z by the label rather than the key", () => {
    // "Aardvark" sorts first by key and last by label, so this fails if the
    // sort still reads the key. A pack renamed across a letter boundary would
    // otherwise land somewhere the reader has no way to predict.
    const result = filterAndSortPacks(
      [
        {
          pack: "Aardvark",
          white: 1,
          black: 0,
          total: 1,
          isDefault: false,
          displayName: "Zulu Pack",
          series: null,
        },
        { pack: "Bison Pack", white: 1, black: 0, total: 1, isDefault: false },
      ],
      { search: "", defaultOnly: false, sort: "name" },
    );

    expect(result.map((t) => t.pack)).toEqual(["Bison Pack", "Aardvark"]);
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

// ─── pickRandomPacks ────────────────────────────────────────────────
//
// Backs the host's "Shuffle packs" button. The contract that matters is not
// "returns random packs" but "returns a selection the game can actually
// start with": server/api/game/start.post.ts throws a 500 when the chosen
// packs yield no black cards, so a shuffle that lands in the card budget but
// picks only white-only packs is a bug, not a quirk.

/** Deterministic stand-in for Math.random: cycles a fixed sequence. */
function seededRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

function packTile(
  pack: string,
  white: number,
  black: number,
  isDefault = false,
): PackTile {
  return { pack, white, black, total: white + black, isDefault };
}

/** 12 packs of 250 cards each — 3000 total, so a 1000–2000 budget has slack. */
function library(): PackTile[] {
  return Array.from({ length: 12 }, (_, i) =>
    packTile(`Pack ${i + 1}`, 200, 50),
  );
}

function totalFor(tiles: PackTile[], picked: string[]): number {
  const chosen = new Set(picked);
  return tiles
    .filter((t) => chosen.has(t.pack))
    .reduce((sum, t) => sum + t.total, 0);
}

function blackFor(tiles: PackTile[], picked: string[]): number {
  const chosen = new Set(picked);
  return tiles
    .filter((t) => chosen.has(t.pack))
    .reduce((sum, t) => sum + t.black, 0);
}

describe("pickRandomPacks", () => {
  it("lands the combined card count inside the requested budget", () => {
    const tiles = library();
    const picked = pickRandomPacks(tiles, { rng: seededRng([0.1, 0.7, 0.3]) });
    const total = totalFor(tiles, picked);

    expect(total).toBeGreaterThanOrEqual(1000);
    expect(total).toBeLessThanOrEqual(2000);
  });

  it("stays in budget across many different rolls", () => {
    const tiles = library();
    for (let seed = 0; seed < 50; seed++) {
      const rng = seededRng([
        (seed * 0.017) % 1,
        (seed * 0.041 + 0.3) % 1,
        (seed * 0.093 + 0.6) % 1,
      ]);
      const total = totalFor(tiles, pickRandomPacks(tiles, { rng }));
      expect(total).toBeGreaterThanOrEqual(1000);
      expect(total).toBeLessThanOrEqual(2000);
    }
  });

  it("never returns a selection without black cards", () => {
    // Every white-only pack is big enough to fill the budget on its own, so a
    // picker that only counts totals would happily return an unplayable deck.
    const tiles = [
      packTile("Whites A", 900, 0),
      packTile("Whites B", 900, 0),
      packTile("Whites C", 900, 0),
      packTile("Blacks", 0, 120),
    ];
    const picked = pickRandomPacks(tiles, { rng: seededRng([0.1, 0.2, 0.3]) });

    expect(blackFor(tiles, picked)).toBeGreaterThan(0);
  });

  it("tops up until the black-card floor is met", () => {
    const tiles = [
      packTile("Mostly white", 1100, 5),
      ...Array.from({ length: 6 }, (_, i) => packTile(`Black ${i}`, 0, 20)),
    ];
    const picked = pickRandomPacks(tiles, {
      minBlack: 40,
      rng: seededRng([0, 0, 0]),
    });

    expect(blackFor(tiles, picked)).toBeGreaterThanOrEqual(40);
  });

  it("returns every pack when the whole library is under the minimum", () => {
    const tiles = [packTile("Small", 200, 40), packTile("Tiny", 60, 10)];
    const picked = pickRandomPacks(tiles, { rng: seededRng([0.5]) });

    expect(picked.sort()).toEqual(["Small", "Tiny"]);
  });

  it("accepts a single oversized pack rather than returning nothing", () => {
    // One pack blows past the ceiling on its own; skipping it would leave an
    // empty selection, which is worse than an over-budget one.
    const tiles = [packTile("Monster", 4000, 800)];
    const picked = pickRandomPacks(tiles, { rng: seededRng([0.5]) });

    expect(picked).toEqual(["Monster"]);
  });

  it("skips a pack that would push the selection past the ceiling", () => {
    const tiles = [
      packTile("Big", 1400, 400),
      packTile("Huge", 1800, 400),
      packTile("Filler", 40, 10),
    ];
    const picked = pickRandomPacks(tiles, { rng: seededRng([0, 0, 0]) });

    expect(totalFor(tiles, picked)).toBeLessThanOrEqual(2000);
  });

  it("ignores packs that have no active cards", () => {
    const tiles = [...library(), packTile("Empty", 0, 0)];
    const picked = pickRandomPacks(tiles, { rng: seededRng([0.4, 0.8, 0.2]) });

    expect(picked).not.toContain("Empty");
  });

  it("re-rolls when the first result matches the current selection", () => {
    // Clicking Shuffle and seeing the same packs reads as a broken button.
    const tiles = library();
    const first = pickRandomPacks(tiles, { rng: seededRng([0.1, 0.7, 0.3]) });
    const second = pickRandomPacks(tiles, {
      rng: seededRng([0.1, 0.7, 0.3]),
      exclude: first,
    });

    expect(new Set(second)).not.toEqual(new Set(first));
  });

  it("returns an empty selection when there are no packs at all", () => {
    expect(pickRandomPacks([], { rng: seededRng([0.5]) })).toEqual([]);
  });
});

describe("pickRandomPacks — variety floor", () => {
  it("keeps adding packs when one big pack already clears the card floor", () => {
    // CAH Base Set is ~1400 cards on its own. Without a pack floor the greedy
    // loop stops the moment it lands first, and "Shuffle" hands the host back
    // a single pack — the opposite of changing things up.
    const tiles = [
      packTile("Base Set", 1200, 220),
      ...Array.from({ length: 10 }, (_, i) => packTile(`Small ${i}`, 24, 6)),
    ];
    // 0.999 makes Fisher-Yates a no-op, so Base Set stays first and lands in
    // the selection before anything else has a chance to.
    const picked = pickRandomPacks(tiles, { rng: seededRng([0.999]) });

    expect(picked.length).toBeGreaterThanOrEqual(3);
    expect(totalFor(tiles, picked)).toBeLessThanOrEqual(2000);
  });

  it("honours a custom pack floor", () => {
    const tiles = library();
    const picked = pickRandomPacks(tiles, {
      minPacks: 6,
      rng: seededRng([0.2, 0.6, 0.9]),
    });

    expect(picked.length).toBeGreaterThanOrEqual(6);
  });

  it("cannot invent packs to satisfy the floor", () => {
    const tiles = [packTile("Only", 800, 200)];
    const picked = pickRandomPacks(tiles, { rng: seededRng([0.5]) });

    expect(picked).toEqual(["Only"]);
  });
});

describe("countLabsCards", () => {
  it("counts only Labs packs, including future volumes", () => {
    const tiles = [
      tile("CAH Base Set", 1400),
      tile("Unfit Labs", 42),
      tile("Unfit Labs Vol. 2", 8),
    ];

    expect(countLabsCards(tiles)).toBe(50);
  });

  it("is 0 before any Labs pack exists", () => {
    expect(countLabsCards([tile("CAH Base Set", 1400)])).toBe(0);
  });

  it("does not match a pack that merely mentions labs", () => {
    expect(isLabsPack("Mad Science Labs")).toBe(false);
    expect(isLabsPack("  unfit labs  ")).toBe(true);
  });
});
