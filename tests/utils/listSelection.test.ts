import { describe, it, expect } from "vitest";
import { applyClick, pruneSelection, type SelectionState } from "~/utils/listSelection";

const order = ["a", "b", "c", "d", "e"];
const empty: SelectionState = { selected: [], anchor: null };

describe("applyClick", () => {
  it("replaces the selection on a plain click", () => {
    const s = applyClick({ selected: ["a", "b"], anchor: "a" }, "c", {}, order);
    expect(s).toEqual({ selected: ["c"], anchor: "c" });
  });

  it("toggles with Ctrl and with Meta", () => {
    let s = applyClick({ selected: ["a"], anchor: "a" }, "c", { ctrlKey: true }, order);
    expect(s).toEqual({ selected: ["a", "c"], anchor: "c" });
    s = applyClick(s, "a", { metaKey: true }, order);
    expect(s).toEqual({ selected: ["c"], anchor: "a" });
  });

  it("adds the anchor-to-target range with Shift, forwards and backwards", () => {
    expect(applyClick({ selected: ["b"], anchor: "b" }, "d", { shiftKey: true }, order)).toEqual({
      selected: ["b", "c", "d"],
      anchor: "b",
    });
    expect(applyClick({ selected: ["d"], anchor: "d" }, "b", { shiftKey: true }, order)).toEqual({
      selected: ["d", "b", "c"],
      anchor: "d",
    });
  });

  it("keeps an existing Ctrl selection when Shift extends", () => {
    const s = applyClick({ selected: ["a", "d"], anchor: "d" }, "e", { shiftKey: true }, order);
    expect(s.selected.sort()).toEqual(["a", "d", "e"]);
  });

  it("treats Shift with no anchor as a plain click", () => {
    expect(applyClick(empty, "c", { shiftKey: true }, order)).toEqual({ selected: ["c"], anchor: "c" });
  });

  it("treats Shift with an anchor filtered out of view as a plain click", () => {
    expect(applyClick({ selected: [], anchor: "zz" }, "c", { shiftKey: true }, order)).toEqual({
      selected: ["c"],
      anchor: "c",
    });
  });
});

describe("pruneSelection", () => {
  it("drops ids that are no longer visible and a hidden anchor", () => {
    expect(pruneSelection({ selected: ["a", "x"], anchor: "x" }, order)).toEqual({
      selected: ["a"],
      anchor: null,
    });
  });

  it("returns the same state object when nothing changes", () => {
    const state = { selected: ["a"], anchor: "a" };
    expect(pruneSelection(state, order)).toBe(state);
  });
});
