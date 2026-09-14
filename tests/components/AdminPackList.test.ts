import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminPackList from "~/components/admin/AdminPackList.vue";
import { buildPackList } from "~/utils/packListView";
import type { AdminPack } from "~/types/adminCard";

const pack = (name: string, over: Partial<AdminPack> = {}): AdminPack => ({
  id: `id-${name}`, name, series: "CAH", description: null, icon: null, color: null, sortOrder: 0,
  official: false, nsfw: false, isDefault: false, legacyKey: null,
  white: { total: 10, active: 10 }, black: { total: 0, active: 0 }, ...over,
});

const stubs = {
  UContextMenu: { props: ["items"], template: "<div class='ctx'><slot /></div>" },
  UInput: { props: ["modelValue"], emits: ["update:modelValue"], template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />` },
  UCheckbox: { props: ["modelValue"], emits: ["update:modelValue"], template: `<input type="checkbox" :checked="modelValue" @change="$emit('update:modelValue', $event.target.checked)" />` },
  UButton: { template: "<button v-bind='$attrs'><slot /></button>" },
  UIcon: true,
};

const rows = buildPackList(
  [pack("Base", { isDefault: true }), pack("Off", { white: { total: 5, active: 0 } })],
  { search: "", chip: "all", sort: "name", grouped: true },
);
const counts = { all: 2, default: 1, official: 0, nsfw: 0, inactive: 1 };

const mountList = (props = {}) =>
  mount(AdminPackList, {
    props: {
      rows, selectedIds: ["id-Base"], currentId: "id-Base", chipCounts: counts, totalCards: 15, menu: [[]],
      search: "", chip: "all", sort: "name", grouped: true, ...props,
    },
    global: { stubs },
  });

describe("AdminPackList", () => {
  it("renders group headers and pack rows with selection state", () => {
    const w = mountList();
    expect(w.findAll("[data-testid='pack-group']")).toHaveLength(1);
    expect(w.get("[data-testid='pack-row-id-Base']").attributes("aria-selected")).toBe("true");
    expect(w.get("[data-testid='pack-row-id-Off']").attributes("aria-selected")).toBe("false");
    expect(w.get("[data-testid='pack-row-id-Off']").classes()).toContain("opacity-50");
  });

  it("emits click with the modifier keys", async () => {
    const w = mountList();
    await w.get("[data-testid='pack-row-id-Off']").trigger("click", { ctrlKey: true });
    expect(w.emitted("click")?.[0]).toEqual(["id-Off", { ctrlKey: true, metaKey: false, shiftKey: false }]);
  });

  it("selects an unselected pack before its context menu opens", async () => {
    const w = mountList();
    await w.get("[data-testid='pack-row-id-Off']").trigger("contextmenu");
    expect(w.emitted("click")?.[0]).toEqual(["id-Off", { ctrlKey: false, metaKey: false, shiftKey: false }]);
    expect(w.emitted("contextmenu")?.[0]).toEqual(["id-Off"]);

    await w.get("[data-testid='pack-row-id-Base']").trigger("contextmenu");
    expect(w.emitted("click")).toHaveLength(1);
  });

  it("updates sort, chip and grouping models", async () => {
    const w = mountList();
    await w.get("[data-testid='pack-sort-size']").trigger("click");
    await w.get("[data-testid='pack-chip-inactive']").trigger("click");
    await w.get("[data-testid='pack-grouped']").setValue(false);
    expect(w.emitted("update:sort")?.[0]).toEqual(["size"]);
    expect(w.emitted("update:chip")?.[0]).toEqual(["inactive"]);
    expect(w.emitted("update:grouped")?.[0]).toEqual([false]);
  });

  it("emits all from the All packs row", async () => {
    const w = mountList();
    await w.get("[data-testid='pack-all']").trigger("click");
    expect(w.emitted("all")).toHaveLength(1);
  });
});
