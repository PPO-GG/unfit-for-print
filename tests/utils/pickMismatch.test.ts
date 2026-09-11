import { describe, it, expect } from "vitest";
import {
  countBlanks,
  suggestedPick,
  findPickMismatches,
} from "~/utils/pickMismatch";

describe("countBlanks", () => {
  it("counts each run of underscores as one blank", () => {
    expect(countBlanks("___ and ___ walk into a bar.")).toBe(2);
  });

  it("counts a single underscore as a blank", () => {
    expect(countBlanks("I love _.")).toBe(1);
  });

  it("counts a blank with a suffix attached as one blank", () => {
    expect(countBlanks("Grandma's ____s.")).toBe(1);
  });

  it("returns 0 for text with no blanks", () => {
    expect(countBlanks("Make a haiku.")).toBe(0);
  });

  it("returns 0 for an image card with no text", () => {
    expect(countBlanks(null)).toBe(0);
    expect(countBlanks(undefined)).toBe(0);
  });
});

describe("suggestedPick", () => {
  it("has no opinion on cards with fewer than two blanks", () => {
    expect(suggestedPick("Make a haiku.")).toBeNull();
    expect(suggestedPick("I love ___.")).toBeNull();
  });

  it("suggests the blank count for two or three blanks", () => {
    expect(suggestedPick("___ + ___ = ___.")).toBe(3);
    expect(suggestedPick("___ and ___.")).toBe(2);
  });

  it("caps the suggestion at the game's maximum pick", () => {
    expect(suggestedPick("_ _ _ _ _")).toBe(3);
  });
});

describe("findPickMismatches", () => {
  it("flags a two-blank card set to pick 1, with the suggested pick", () => {
    const card = { id: "a", text: "___ and ___.", pick: 1 };
    expect(findPickMismatches([card])).toEqual([{ card, blanks: 2, suggested: 2 }]);
  });

  it("treats a missing pick as pick 1", () => {
    const card = { id: "a", text: "___ and ___." };
    expect(findPickMismatches([card])).toHaveLength(1);
  });

  it("leaves matching cards alone", () => {
    expect(findPickMismatches([{ id: "a", text: "___ and ___.", pick: 2 }])).toEqual([]);
  });

  it("leaves blankless multi-pick cards alone", () => {
    expect(findPickMismatches([{ id: "a", text: "Make a haiku.", pick: 3 }])).toEqual([]);
  });

  it("does not flag a card with more blanks than the maximum pick once it is at the maximum", () => {
    expect(findPickMismatches([{ id: "a", text: "_ _ _ _", pick: 3 }])).toEqual([]);
  });
});
