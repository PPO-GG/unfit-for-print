import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import AdminCardTable from "~/components/admin/AdminCardTable.vue";
import type { AdminCard } from "~/types/adminCard";

const card = (id: string, over: Partial<AdminCard> = {}): AdminCard => ({
  id, type: "white", text: id, packId: "p", pack: "P", active: true, ...over,
});
const cards = [card("a"), card("b")];

// A stand-in UTable: renders one <tr> per row and forwards the same events the
// real one emits, so routing can be tested without the virtualizer.
const UTable = {
  props: ["data", "meta"],
  emits: ["select", "contextmenu"],
  template: `<table><tr v-for="r in data" :key="r.id" :data-id="r.id"
      @click="$emit('select', $event, { original: r, id: r.id })"
      @contextmenu="$emit('contextmenu', $event, { original: r, id: r.id })"><td>{{ r.text }}</td></tr></table>`,
};
const stubs = { UTable, UContextMenu: { template: "<div><slot /></div>" }, UCheckbox: true, UBadge: true, UButton: true };

const mountTable = (props = {}) =>
  mount(AdminCardTable, {
    props: { cards, selectedIds: ["a"], currentId: "a", menu: [[]], sort: null, ...props },
    global: { stubs },
  });

afterEach(() => vi.useRealTimers());

describe("AdminCardTable", () => {
  it("emits click with modifiers when a row is selected", async () => {
    const w = mountTable();
    await w.get("tr[data-id='b']").trigger("click", { shiftKey: true });
    expect(w.emitted("click")?.[0]).toEqual(["b", { ctrlKey: false, metaKey: false, shiftKey: true }]);
  });

  it("emits open on a double click of the same row", async () => {
    vi.useFakeTimers();
    const w = mountTable();
    await w.get("tr[data-id='b']").trigger("click");
    vi.advanceTimersByTime(200);
    await w.get("tr[data-id='b']").trigger("click");
    expect(w.emitted("open")?.[0]).toEqual(["b"]);
  });

  it("does not treat slow clicks or different rows as a double click", async () => {
    vi.useFakeTimers();
    const w = mountTable();
    await w.get("tr[data-id='a']").trigger("click");
    await w.get("tr[data-id='b']").trigger("click");
    vi.advanceTimersByTime(500);
    await w.get("tr[data-id='b']").trigger("click");
    expect(w.emitted("open")).toBeUndefined();
  });

  it("selects before the context menu on an unselected row", async () => {
    const w = mountTable();
    await w.get("tr[data-id='b']").trigger("contextmenu");
    expect(w.emitted("click")?.[0]?.[0]).toBe("b");
    expect(w.emitted("contextmenu")?.[0]).toEqual(["b"]);
  });

  it("marks selected and current rows", () => {
    const w = mountTable({ selectedIds: ["a"], currentId: "b" });
    const rowClass = (w.vm as unknown as { rowClass: (r: { original: AdminCard }) => string }).rowClass;
    expect(rowClass({ original: cards[0]! })).toContain("bg-primary-900/40");
    expect(rowClass({ original: cards[1]! })).toContain("ring-primary-500/60");
  });

  it("cycles sort ascending, descending, off", async () => {
    const w = mountTable();
    const vm = w.vm as unknown as { cycleSort: (k: string) => void };
    vm.cycleSort("played");
    await w.setProps({ sort: { key: "played", desc: false } });
    vm.cycleSort("played");
    await w.setProps({ sort: { key: "played", desc: true } });
    vm.cycleSort("played");
    expect(w.emitted("update:sort")).toEqual([
      [{ key: "played", desc: false }],
      [{ key: "played", desc: true }],
      [null],
    ]);
  });
});
