import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminMergeDialog from "~/components/admin/AdminMergeDialog.vue";
import AdminMoveDialog from "~/components/admin/AdminMoveDialog.vue";
import AdminSeriesDialog from "~/components/admin/AdminSeriesDialog.vue";
import type { AdminPack } from "~/types/adminCard";

const pack = (id: string): AdminPack => ({
  id, name: `Pack ${id}`, series: null, description: null, icon: null, color: null, sortOrder: 0,
  official: false, nsfw: false, isDefault: false, legacyKey: null,
  white: { total: 1, active: 1 }, black: { total: 0, active: 0 },
});

const stubs = {
  UModal: { props: ["open"], template: "<div v-if='open'><slot name='body' /><slot name='footer' /></div>" },
  USelectMenu: { props: ["modelValue", "items"], emits: ["update:modelValue"], template: `<select data-testid="merge-target" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><option value=""></option><option v-for="i in items" :key="i.id" :value="i.id">{{ i.name }}</option></select>` },
  AdminPackPicker: { props: ["modelValue"], emits: ["update:modelValue"], template: `<input data-testid="picker" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />` },
  UInput: { props: ["modelValue"], emits: ["update:modelValue"], template: `<input data-testid="series-input" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />` },
  UButton: { props: ["disabled"], template: "<button :disabled='disabled' v-bind='$attrs'><slot /></button>" },
  UFormField: { template: "<div><slot /></div>" },
};

describe("AdminMergeDialog", () => {
  it("shows the summary for a chosen target and confirms it", async () => {
    const w = mount(AdminMergeDialog, {
      props: { open: true, sources: [pack("a"), pack("b")], packs: [pack("a"), pack("b"), pack("c")], summary: (_s: AdminPack[], t: AdminPack) => `into ${t.name}` },
      global: { stubs },
    });
    expect(w.get("[data-testid='merge-confirm']").attributes("disabled")).toBeDefined();
    await w.get("[data-testid='merge-target']").setValue("c");
    expect(w.get("[data-testid='merge-summary']").text()).toBe("into Pack c");
    await w.get("[data-testid='merge-confirm']").trigger("click");
    expect(w.emitted("confirm")?.[0]?.[0]).toMatchObject({ id: "c" });
  });

  it("refuses a target that is the only source", async () => {
    const w = mount(AdminMergeDialog, {
      props: { open: true, sources: [pack("a")], packs: [pack("a"), pack("b")], summary: () => "" },
      global: { stubs },
    });
    await w.get("[data-testid='merge-target']").setValue("a");
    expect(w.get("[data-testid='merge-confirm']").attributes("disabled")).toBeDefined();
  });
});

describe("AdminMoveDialog", () => {
  it("confirms a typed or picked pack name", async () => {
    const w = mount(AdminMoveDialog, { props: { open: true, count: 3, packNames: ["Base"] }, global: { stubs } });
    await w.get("[data-testid='picker']").setValue("  New Pack ");
    // Checked before confirming: a real (and stubbed) UModal unmounts its
    // body/footer once `open` flips false, which the confirm click below does.
    expect(w.text()).toContain("Move 3 cards");
    await w.get("[data-testid='move-confirm']").trigger("click");
    expect(w.emitted("confirm")?.[0]).toEqual(["New Pack"]);
  });
});

describe("AdminSeriesDialog", () => {
  it("starts from the initial value and confirms, allowing empty to clear", async () => {
    const w = mount(AdminSeriesDialog, { props: { open: true, count: 2, initial: "CAH" }, global: { stubs } });
    expect((w.get("[data-testid='series-input']").element as HTMLInputElement).value).toBe("CAH");
    await w.get("[data-testid='series-input']").setValue("");
    await w.get("[data-testid='series-confirm']").trigger("click");
    expect(w.emitted("confirm")?.[0]).toEqual([""]);
  });
});
