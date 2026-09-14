import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminExplorerInspector from "~/components/admin/AdminExplorerInspector.vue";
import type { AdminCard, AdminPack } from "~/types/adminCard";

const pack: AdminPack = {
  id: "p1", name: "Base", series: null, description: null, icon: null, color: null, sortOrder: 0,
  official: false, nsfw: false, isDefault: false, legacyKey: null,
  white: { total: 1, active: 1 }, black: { total: 0, active: 0 },
};
const card: AdminCard = { id: "c1", type: "white", text: "t", packId: "p1", pack: "Base", active: true };

const stub = (name: string, emits: string[]) => ({
  name,
  emits,
  template: `<div data-testid="${name}"><button v-for="e in ${JSON.stringify(emits).replace(/"/g, "'")}" :key="e" :data-emit="e" @click="$emit(e, 'x')" /></div>`,
});
const stubs = {
  AdminCardForm: stub("AdminCardForm", ["save", "toggle-active", "delete"]),
  AdminCardBulkForm: stub("AdminCardBulkForm", ["apply", "delete", "narrow", "drop"]),
  AdminPackForm: stub("AdminPackForm", ["save", "delete"]),
  AdminPackBulkForm: stub("AdminPackBulkForm", ["apply", "merge", "delete", "narrow", "drop"]),
};
const mountInspector = (props: Record<string, unknown>) =>
  mount(AdminExplorerInspector, {
    props: { focus: "card", packs: [], cards: [], packNames: [], packCards: [], seriesPrefix: "", ...props },
    global: { stubs },
  });

describe("AdminExplorerInspector", () => {
  it("picks the editor from focus and selection size", () => {
    expect(mountInspector({}).find("[data-testid='inspector-empty']").exists()).toBe(true);
    expect(mountInspector({ cards: [card] }).find("[data-testid='AdminCardForm']").exists()).toBe(true);
    expect(mountInspector({ cards: [card, { ...card, id: "c2" }] }).find("[data-testid='AdminCardBulkForm']").exists()).toBe(true);
    expect(mountInspector({ focus: "pack", packs: [pack] }).find("[data-testid='AdminPackForm']").exists()).toBe(true);
    expect(mountInspector({ focus: "pack", packs: [pack, { ...pack, id: "p2" }] }).find("[data-testid='AdminPackBulkForm']").exists()).toBe(true);
  });

  it("re-emits child events with a scope", async () => {
    const w = mountInspector({ focus: "pack", packs: [pack, { ...pack, id: "p2" }] });
    await w.get("[data-emit='merge']").trigger("click");
    await w.get("[data-emit='narrow']").trigger("click");
    expect(w.emitted("packs-merge")).toHaveLength(1);
    expect(w.emitted("narrow")?.[0]).toEqual(["pack", "x"]);
  });
});
