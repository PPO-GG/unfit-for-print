import { describe, it, expect } from "vitest";
import { normalizePackSelection } from "~/utils/lobbyPackSelection";

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

  it("collapses a name and its id to one entry", () => {
    expect(normalizePackSelection([A, "CAH Base Set"], roster)).toEqual({ ids: [A], changed: true });
  });
});
