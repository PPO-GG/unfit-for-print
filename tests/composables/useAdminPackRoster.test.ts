import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));

import { mergeRoster, useAdminPackRoster } from "~/composables/useAdminPackRoster";

const adminMeta = [
  { id: "p1", pack: "Base Pack", description: "d", icon: null, color: null, sortOrder: 0, official: true, nsfw: false, series: "CAH", isDefault: true },
  { id: "p2", pack: "Empty", description: null, icon: null, color: null, sortOrder: 0, official: false, nsfw: false, series: null, isDefault: false },
];
const stats = {
  white: [{ packId: "p1", pack: "Base Pack", total: 10, active: 8 }],
  black: [{ packId: "p1", pack: "Base Pack", total: 4, active: 4 }],
  meta: [
    { id: "p1", pack: "Base Pack", legacyKey: "CAH Base Set", series: "CAH", description: "d", official: true, nsfw: false },
    { id: "p2", pack: "Empty", legacyKey: null, series: null, description: null, official: false, nsfw: false },
  ],
};

// Block body, not `() => fetchMock.mockReset()`: mockReset() returns the mock
// itself for chaining, and Vitest treats a value returned from beforeEach as
// an implicit afterEach cleanup — which would re-invoke fetchMock with no
// arguments after every test.
beforeEach(() => {
  fetchMock.mockReset();
});

describe("mergeRoster", () => {
  it("builds one pack per registry row with counts and legacy key", () => {
    expect(mergeRoster(stats, adminMeta)).toEqual([
      {
        id: "p1", name: "Base Pack", series: "CAH", description: "d", icon: null, color: null,
        sortOrder: 0, official: true, nsfw: false, isDefault: true, legacyKey: "CAH Base Set",
        white: { total: 10, active: 8 }, black: { total: 4, active: 4 },
      },
      {
        id: "p2", name: "Empty", series: null, description: null, icon: null, color: null,
        sortOrder: 0, official: false, nsfw: false, isDefault: false, legacyKey: null,
        white: { total: 0, active: 0 }, black: { total: 0, active: 0 },
      },
    ]);
  });
});

describe("useAdminPackRoster", () => {
  it("loads both endpoints and finds packs by legacy key or name", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url === "/api/cards/packs" ? stats : { packs: adminMeta }),
    );
    const roster = useAdminPackRoster();
    await roster.load();

    expect(roster.packs.value.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(roster.byId.value.get("p2")?.name).toBe("Empty");
    expect(roster.findByName("CAH Base Set")?.id).toBe("p1");
    expect(roster.findByName("Empty")?.id).toBe("p2");
    expect(roster.findByName("Nope")).toBeUndefined();
  });
});
