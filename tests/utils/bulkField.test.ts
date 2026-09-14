import { describe, it, expect } from "vitest";
import { sharedValue } from "~/utils/bulkField";

describe("sharedValue", () => {
  it("reports one shared value", () => {
    expect(sharedValue([{ a: 1 }, { a: 1 }], (i) => i.a)).toEqual({ state: "same", value: 1 });
  });
  it("reports mixed values", () => {
    expect(sharedValue([{ a: 1 }, { a: 2 }], (i) => i.a)).toEqual({ state: "mixed" });
  });
  it("reports empty for no items", () => {
    expect(sharedValue([], (i: { a: number }) => i.a)).toEqual({ state: "empty" });
  });
  it("treats null and undefined as the same value", () => {
    expect(sharedValue([{ a: null }, { a: undefined }], (i) => i.a ?? null)).toEqual({
      state: "same",
      value: null,
    });
  });
});
