// The windowed grid virtualises by ROW, so it has to know how many cards are
// in a row before it can know how many rows there are.
import { describe, it, expect } from "vitest";
import { gridGeometry, chunkRows } from "~/utils/gridGeometry";

describe("gridGeometry", () => {
  it("fits as many whole tiles as the width allows, counting gaps", () => {
    // 1000 = 4 tiles of 200 plus 3 gaps of 12 (=1236 is too wide) → 4 columns
    expect(gridGeometry(1000).columns).toBe(4);
  });

  it("never returns fewer than one column, however narrow", () => {
    expect(gridGeometry(50).columns).toBe(1);
    expect(gridGeometry(0).columns).toBe(1);
  });

  it("divides the leftover space into the tiles rather than leaving a ragged edge", () => {
    const { columns, tileWidth } = gridGeometry(1000);
    expect(columns * tileWidth + (columns - 1) * 12).toBeCloseTo(1000, 0);
  });

  it("honours a custom minimum tile size", () => {
    expect(gridGeometry(1000, 320).columns).toBe(3);
  });
});

describe("chunkRows", () => {
  it("splits a list into rows of the given width", () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no rows for an empty list", () => {
    expect(chunkRows([], 4)).toEqual([]);
  });

  it("puts everything in one row when columns exceeds the count", () => {
    expect(chunkRows([1, 2], 10)).toEqual([[1, 2]]);
  });

  it("guards against a zero column count instead of looping forever", () => {
    expect(chunkRows([1, 2], 0)).toEqual([[1], [2]]);
  });
});
