import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminPackForm from "~/components/admin/AdminPackForm.vue";
import type { AdminPack } from "~/types/adminCard";

const stubs = {
  UInput: { props: ["modelValue"], emits: ["update:modelValue"], template: `<input :value="modelValue" v-bind="$attrs" @input="$emit('update:modelValue', $event.target.value)" />` },
  UTextarea: { props: ["modelValue"], emits: ["update:modelValue"], template: `<textarea :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />` },
  USwitch: { props: ["modelValue", "label"], emits: ["update:modelValue"], template: `<label><input type="checkbox" :checked="modelValue" @change="$emit('update:modelValue', $event.target.checked)" />{{ label }}</label>` },
  UFormField: { props: ["label"], template: "<div><label>{{ label }}</label><slot /></div>" },
  UButton: { props: ["disabled"], template: "<button :disabled='disabled' v-bind='$attrs'><slot /></button>" },
};

const pack = (over: Partial<AdminPack> = {}): AdminPack => ({
  id: "p1", name: "Cards Against Humanity: Blue Box", series: null, description: null, icon: null, color: null,
  sortOrder: 0, official: false, nsfw: false, isDefault: false, legacyKey: null,
  white: { total: 10, active: 10 }, black: { total: 2, active: 2 }, ...over,
});

type Vm = { draft: Record<string, unknown>; dirty: boolean; save: () => void; revert: () => void };
const mountForm = (p = pack(), seriesPrefix = "Cards Against Humanity: ") =>
  mount(AdminPackForm, { props: { pack: p, seriesPrefix }, global: { stubs } });
const vmOf = (w: ReturnType<typeof mountForm>) => w.vm as unknown as Vm;

describe("AdminPackForm", () => {
  it("seeds every field from the pack, clean", () => {
    const vm = vmOf(mountForm(pack({ series: "CAH", isDefault: true })));
    expect(vm.draft).toMatchObject({ name: "Cards Against Humanity: Blue Box", series: "CAH", isDefault: true, active: true });
    expect(vm.dirty).toBe(false);
  });

  it("has a Name field", () => {
    expect(mountForm().text()).toContain("Name");
  });

  it("offers the derived series without dirtying the form", async () => {
    const w = mountForm();
    expect(vmOf(w).dirty).toBe(false);
    await w.get("[data-testid='use-series-suggestion']").trigger("click");
    expect(vmOf(w).draft.series).toBe("Cards Against Humanity");
    expect(vmOf(w).dirty).toBe(true);
  });

  it("emits a normalized draft on save and nothing while clean", () => {
    const w = mountForm();
    vmOf(w).save();
    expect(w.emitted("save")).toBeUndefined();

    vmOf(w).draft.name = "  Blue   Box ";
    vmOf(w).draft.series = " Cards  Against Humanity ";
    vmOf(w).save();
    expect(w.emitted("save")?.[0]?.[0]).toMatchObject({ name: "Blue Box", series: "Cards Against Humanity" });
    expect(vmOf(w).draft.name).toBe("Blue Box");
  });

  it("picks up a reload of the same pack while clean", async () => {
    const w = mountForm();
    await w.setProps({ pack: pack({ description: "server" }) });
    expect(vmOf(w).draft.description).toBe("server");
    expect(vmOf(w).dirty).toBe(false);
  });

  it("reverts, and keeps a dirty draft across a reload of the same pack", async () => {
    const w = mountForm();
    vmOf(w).draft.description = "mine";
    await w.setProps({ pack: pack({ description: "server" }) });
    expect(vmOf(w).draft.description).toBe("mine");
    vmOf(w).revert();
    expect(vmOf(w).draft.description).toBe("server");
  });

  it("re-seeds for a different pack", async () => {
    const w = mountForm();
    vmOf(w).draft.description = "mine";
    await w.setProps({ pack: pack({ id: "p2", name: "Other" }) });
    expect(vmOf(w).draft.name).toBe("Other");
  });

  it("warns about caps in the name or series", async () => {
    const w = mountForm();
    vmOf(w).draft.name = "BLUE BOX EXPANSION";
    await w.vm.$nextTick();
    expect(w.find("[data-testid='pack-shout-hint']").exists()).toBe(true);
  });

  it("goes clean once a reload arrives carrying the saved, normalized name", async () => {
    const w = mountForm();
    vmOf(w).draft.name = "  Blue   Box ";
    vmOf(w).save();
    await w.setProps({ pack: pack({ name: "Blue Box" }) });
    expect(vmOf(w).dirty).toBe(false);
  });
});
