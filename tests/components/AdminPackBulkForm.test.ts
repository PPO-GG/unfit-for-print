import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminPackBulkForm from "~/components/admin/AdminPackBulkForm.vue";
import type { AdminPack } from "~/types/adminCard";

const stubs = {
  UInput: { props: ["modelValue", "placeholder"], emits: ["update:modelValue"], template: `<input data-testid="series" :placeholder="placeholder" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />` },
  UButton: { props: ["disabled"], template: "<button :disabled='disabled' v-bind='$attrs'><slot /></button>" },
  UFormField: { props: ["label"], template: "<div><label>{{ label }}</label><slot /></div>" },
};
const pack = (id: string, over: Partial<AdminPack> = {}): AdminPack => ({
  id, name: id, series: "CAH", description: null, icon: null, color: null, sortOrder: 0,
  official: true, nsfw: false, isDefault: false, legacyKey: null,
  white: { total: 10, active: 10 }, black: { total: 0, active: 0 }, ...over,
});
const mountForm = (packs: AdminPack[]) => mount(AdminPackBulkForm, { props: { packs }, global: { stubs } });

describe("AdminPackBulkForm", () => {
  it("shows a shared series and mixed flags", () => {
    const w = mountForm([pack("a", { isDefault: true }), pack("b")]);
    expect((w.get("[data-testid='series']").element as HTMLInputElement).value).toBe("CAH");
    expect(w.find("[data-testid='bulk-default-mixed']").exists()).toBe(true);
    expect(w.text()).toContain("20 cards");
  });

  it("uses a Mixed placeholder when series differ", () => {
    const w = mountForm([pack("a"), pack("b", { series: "Other" })]);
    expect(w.get("[data-testid='series']").attributes("placeholder")).toBe("Mixed");
  });

  it("applies changed fields only, and emits merge", async () => {
    const w = mountForm([pack("a"), pack("b")]);
    await w.get("[data-testid='series']").setValue("Unfit");
    await w.get("[data-testid='bulk-nsfw-on']").trigger("click");
    await w.get("[data-testid='bulk-apply']").trigger("click");
    await w.get("[data-testid='bulk-merge']").trigger("click");
    expect(w.emitted("apply")?.[0]).toEqual([{ series: "Unfit", nsfw: true }]);
    expect(w.emitted("merge")).toHaveLength(1);
  });

  it("settles dirty once the reload reflects an applied series change", async () => {
    const w = mountForm([pack("a"), pack("b")]);
    await w.get("[data-testid='series']").setValue("Unfit");
    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(true);
    await w.setProps({ packs: [pack("a", { series: "Unfit" }), pack("b", { series: "Unfit" })] });
    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(false);
  });

  it("reseeds to a newly shared series while untouched", async () => {
    const w = mountForm([pack("a"), pack("b")]);
    await w.setProps({ packs: [pack("a", { series: "New" }), pack("b", { series: "New" })] });
    expect((w.get("[data-testid='series']").element as HTMLInputElement).value).toBe("New");
    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(false);
  });
});
