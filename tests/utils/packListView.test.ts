import { describe, it, expect } from "vitest";
import { buildPackList, packOrder, isPackDisabled } from "~/utils/packListView";
import type { AdminPack } from "~/types/adminCard";

const pack = (name: string, over: Partial<AdminPack> = {}): AdminPack => ({
  id: `id-${name}`,
  name,
  series: null,
  description: null,
  icon: null,
  color: null,
  sortOrder: 0,
  official: false,
  nsfw: false,
  isDefault: false,
  legacyKey: null,
  white: { total: 10, active: 10 },
  black: { total: 0, active: 0 },
  ...over,
});

const packs = [
  pack("Red Box", { series: "CAH", white: { total: 300, active: 300 } }),
  pack("Base Set", { series: "CAH", white: { total: 1200, active: 1200 }, isDefault: true }),
  pack("Box Expansion", { series: "CAH", white: { total: 48, active: 0 } }),
  pack("Unfit Labs", { series: "Unfit for Print", nsfw: true }),
  pack("Loose Pack"),
];

const view = (over = {}) =>
  buildPackList(packs, { search: "", chip: "all", sort: "name", grouped: true, ...over });

describe("buildPackList", () => {
  it("groups by series A–Z, sorts by name inside, and puts unseries'd packs last", () => {
    const rows = view();
    expect(rows.map((r) => (r.kind === "group" ? `# ${r.label} (${r.count})` : r.pack.name))).toEqual([
      "# CAH (3)",
      "Base Set",
      "Box Expansion",
      "Red Box",
      "# Unfit for Print (1)",
      "Unfit Labs",
      "# No series (1)",
      "Loose Pack",
    ]);
  });

  it("sorts by size largest first within groups", () => {
    const names = packOrder(view({ sort: "size" })).map((id) => id.slice(3));
    expect(names.slice(0, 3)).toEqual(["Base Set", "Red Box", "Box Expansion"]);
  });

  it("puts disabled packs first when sorting by disabled", () => {
    const names = packOrder(view({ sort: "disabled", grouped: false })).map((id) => id.slice(3));
    expect(names[0]).toBe("Box Expansion");
  });

  it("flattens when not grouped", () => {
    expect(view({ grouped: false }).every((r) => r.kind === "pack")).toBe(true);
  });

  it("filters by chip and by search on name or series", () => {
    expect(packOrder(view({ chip: "default" }))).toEqual(["id-Base Set"]);
    expect(packOrder(view({ chip: "nsfw" }))).toEqual(["id-Unfit Labs"]);
    expect(packOrder(view({ chip: "inactive" }))).toEqual(["id-Box Expansion"]);
    expect(packOrder(view({ search: "unfit" }))).toEqual(["id-Unfit Labs"]);
    expect(packOrder(view({ search: "red" }))).toEqual(["id-Red Box"]);
  });

  it("omits empty groups after filtering", () => {
    const rows = view({ chip: "nsfw" });
    expect(rows.filter((r) => r.kind === "group").map((r) => (r as { label: string }).label)).toEqual([
      "Unfit for Print",
    ]);
  });

  it("groups case-insensitively by series and uses the first member's original case", () => {
    const mixedPacks = [
      pack("Pack A", { series: "CAH" }),
      pack("Pack B", { series: "cah" }),
    ];
    const rows = buildPackList(mixedPacks, { search: "", chip: "all", sort: "name", grouped: true });
    expect(rows.filter((r) => r.kind === "group").length).toBe(1);
    const groupLabel = (rows.find((r) => r.kind === "group") as { label: string }).label;
    expect(groupLabel).toBe("CAH");
    expect((rows.find((r) => r.kind === "group") as { count: number }).count).toBe(2);
  });
});

describe("isPackDisabled", () => {
  it("is true only when no card of either type is active", () => {
    expect(isPackDisabled(packs[2]!)).toBe(true);
    expect(isPackDisabled(packs[0]!)).toBe(false);
  });
});
