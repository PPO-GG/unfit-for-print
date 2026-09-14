import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminCardBulkForm from "~/components/admin/AdminCardBulkForm.vue";
import type { AdminCard } from "~/types/adminCard";

const stubs = {
  AdminPackPicker: { props: ["modelValue", "packs", "placeholder"], emits: ["update:modelValue"], template: `<input data-testid="picker" :placeholder="placeholder" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />` },
  UButton: { props: ["disabled"], template: "<button :disabled='disabled' v-bind='$attrs'><slot /></button>" },
  UFormField: { props: ["label"], template: "<div><label>{{ label }}</label><slot /></div>" },
};
const card = (id: string, over: Partial<AdminCard> = {}): AdminCard => ({
  id, type: "white", text: `text ${id}`, packId: "p1", pack: "Base", active: true, ...over,
});
const mountForm = (cards: AdminCard[]) =>
  mount(AdminCardBulkForm, { props: { cards, packs: ["Base", "Red Box"] }, global: { stubs } });

describe("AdminCardBulkForm", () => {
  it("summarises the selection and lists mixed packs in the placeholder", () => {
    const w = mountForm([card("a"), card("b", { type: "black", pack: "Red Box", packId: "p2", pick: 1 })]);
    expect(w.text()).toContain("2 cards");
    expect(w.text()).toContain("1 white · 1 black · 2 packs");
    expect(w.get("[data-testid='picker']").attributes("placeholder")).toContain("Base, Red Box");
  });

  it("shows Mixed status and hides pick unless every card is black", () => {
    const w = mountForm([card("a"), card("b", { active: false })]);
    expect(w.get("[data-testid='bulk-status-mixed']").exists()).toBe(true);
    expect(w.find("[data-testid='bulk-pick-1']").exists()).toBe(false);
    const b = mountForm([card("a", { type: "black", pick: 1 }), card("b", { type: "black", pick: 2 })]);
    expect(b.find("[data-testid='bulk-pick-1']").exists()).toBe(true);
  });

  it("applies only the fields that changed", async () => {
    const w = mountForm([card("a"), card("b", { active: false })]);
    expect(w.get("[data-testid='bulk-apply']").attributes("disabled")).toBeDefined();
    await w.get("[data-testid='bulk-status-off']").trigger("click");
    await w.get("[data-testid='bulk-apply']").trigger("click");
    expect(w.emitted("apply")?.[0]).toEqual([{ active: false }]);
  });

  it("narrows to or drops a listed card", async () => {
    const w = mountForm([card("a"), card("b")]);
    await w.get("[data-testid='bulk-card-b'] [data-testid='narrow']").trigger("click");
    await w.get("[data-testid='bulk-card-a'] [data-testid='drop']").trigger("click");
    expect(w.emitted("narrow")?.[0]).toEqual(["b"]);
    expect(w.emitted("drop")?.[0]).toEqual(["a"]);
  });

  it("caps the list at 50 with a remainder line", () => {
    const w = mountForm(Array.from({ length: 53 }, (_, i) => card(`c${i}`)));
    expect(w.findAll("[data-testid^='bulk-card-']")).toHaveLength(50);
    expect(w.text()).toContain("+ 3 more");
  });
});
