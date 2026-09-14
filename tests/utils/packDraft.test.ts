import { describe, it, expect } from "vitest";
import { draftsEqual, packToDraft } from "~/utils/packDraft";
import type { AdminPack } from "~/types/adminCard";

const pack = (over: Partial<AdminPack> = {}): AdminPack => ({
  id: "p1", name: "Blue Box", series: null, description: null, icon: null, color: null,
  sortOrder: 0, official: false, nsfw: false, isDefault: false, legacyKey: null,
  white: { total: 3, active: 3 }, black: { total: 1, active: 1 }, ...over,
});

describe("packToDraft", () => {
  it("derives active from the pack's active cards", () => {
    expect(packToDraft(pack()).active).toBe(true);
    expect(packToDraft(pack({ white: { total: 3, active: 0 }, black: { total: 1, active: 0 } })).active).toBe(false);
  });

  it("treats an empty pack as enabled, so its switch has nothing to flip", () => {
    expect(packToDraft(pack({ white: { total: 0, active: 0 }, black: { total: 0, active: 0 } })).active).toBe(true);
  });
});

describe("draftsEqual", () => {
  it("compares sortOrder numerically, a blank field counting as 0", () => {
    const d = packToDraft(pack({ sortOrder: 3 }));
    // v-model.number hands back a string for input it cannot parse, and "" when cleared.
    expect(draftsEqual(d, { ...d, sortOrder: "3" as unknown as number })).toBe(true);
    expect(draftsEqual(d, { ...d, sortOrder: "" as unknown as number })).toBe(false);
    const zero = packToDraft(pack());
    expect(draftsEqual(zero, { ...zero, sortOrder: "" as unknown as number })).toBe(true);
    expect(draftsEqual(d, { ...d, sortOrder: 4 })).toBe(false);
  });

  it("still notices any other field changing", () => {
    const d = packToDraft(pack());
    expect(draftsEqual(d, { ...d, nsfw: true })).toBe(false);
  });
});
