import { describe, expect, it } from "vitest";
import { ACTIVITY_REFRESH_MS, shouldPush } from "../src/pushPolicy";

describe("shouldPush", () => {
  it("pushes when nothing has been pushed yet", () => {
    expect(shouldPush(null, 0, "k", 1000)).toBe(true);
  });

  it("pushes when the summary changed", () => {
    expect(shouldPush("a", 1000, "b", 1001)).toBe(true);
  });

  it("does not push an unchanged summary with little new activity", () => {
    expect(shouldPush("a", 1000, "a", 1000 + ACTIVITY_REFRESH_MS - 1)).toBe(false);
  });

  it("pushes an unchanged summary once lastActivity is 30 s ahead of the last push", () => {
    expect(shouldPush("a", 1000, "a", 1000 + ACTIVITY_REFRESH_MS)).toBe(true);
  });
});
