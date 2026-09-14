import { describe, it, expect } from "vitest";
import { normalizePackSelection, packLabelsFor } from "~/utils/lobbyPackSelection";

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
