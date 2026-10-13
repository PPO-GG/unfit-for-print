import { describe, it, expect } from "vitest";
import { normalizePackSelection, packLabelsFor, packRoster, packTally } from "~/utils/lobbyPackSelection";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const roster = [
  { id: A, name: "CAH Base Set" },
  { id: B, name: "Blue Box" },
];

describe("normalizePackSelection", () => {
  it("leaves an all-id selection alone", () => {
    expect(normalizePackSelection([A, B], roster)).toEqual({ ids: [A, B], changed: false });
  });

  it("maps a pre-migration lobby's names to ids", () => {
    expect(normalizePackSelection(["CAH Base Set", B], roster)).toEqual({ ids: [A, B], changed: true });
  });

  it("drops packs that are gone and names that match nothing", () => {
    const gone = "33333333-3333-4333-8333-333333333333";
    expect(normalizePackSelection([A, gone, "Ghost"], roster)).toEqual({ ids: [A], changed: true });
  });

  it("maps a pre-migration raw key to its id through legacyKey", () => {
    const withKeys = [
      { id: A, name: "CAH Base Set", legacyKey: "Base" },
      { id: B, name: "Blue Box", legacyKey: null },
    ];
    expect(normalizePackSelection(["Base", B], withKeys)).toEqual({ ids: [A, B], changed: true });
  });

  it("prefers a legacyKey match over a different pack's name", () => {
    const swapped = [
      { id: A, name: "Y", legacyKey: "X" },
      { id: B, name: "X", legacyKey: "Y" },
    ];
    expect(normalizePackSelection(["X"], swapped)).toEqual({ ids: [A], changed: true });
  });

  it("collapses a name and its id to one entry", () => {
    expect(normalizePackSelection([A, "CAH Base Set"], roster)).toEqual({ ids: [A], changed: true });
  });
});

describe("packLabelsFor", () => {
  it("resolves an id to its roster name", () => {
    expect(packLabelsFor([A, "CAH: Blue Box Expansion"], { [A]: "CAH Base Set" })).toEqual([
      "CAH Base Set",
      "CAH: Blue Box Expansion",
    ]);
  });

  it("drops an id with no matching roster name", () => {
    expect(packLabelsFor([A, B], { [A]: "CAH Base Set" })).toEqual(["CAH Base Set"]);
  });

  it("passes a legacy name entry through unchanged", () => {
    expect(packLabelsFor(["Legacy Name"], {})).toEqual(["Legacy Name"]);
  });
});

const tile = (id: string, white: number, black: number) =>
  ({ id, pack: `P-${id}`, white, black, total: white + black, isDefault: false, legacyKey: id === "a" ? "old-a" : null }) as any;

describe("packTally", () => {
  const tiles = [tile("a", 10, 2), tile("b", 5, 1), tile("c", 1, 1)];

  it("sums only the selected packs", () => {
    expect(packTally(tiles, ["a", "c"])).toEqual({ packs: 2, white: 11, black: 3, all: false });
  });

  it("treats an empty selection as every pack, as game start does", () => {
    expect(packTally(tiles, [])).toEqual({ packs: 3, white: 16, black: 4, all: true });
  });

  it("ignores ids the roster does not know", () => {
    expect(packTally(tiles, ["a", "ghost"]).packs).toBe(1);
  });
});

describe("packRoster", () => {
  it("adapts tiles to the shape normalizePackSelection reads", () => {
    expect(packRoster([tile("a", 1, 1)])).toEqual([{ id: "a", name: "P-a", legacyKey: "old-a" }]);
  });
});
