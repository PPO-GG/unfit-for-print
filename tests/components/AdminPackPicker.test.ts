import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminPackPicker from "~/components/admin/AdminPackPicker.vue";

const stubs = {
  UInput: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
  UButton: { template: "<button><slot /></button>" },
  UFormField: { props: ["label"], template: "<div><label>{{ label }}</label><slot /></div>" },
};

function mountPicker(props: Record<string, unknown> = {}) {
  return mount(AdminPackPicker, {
    props: { modelValue: "", packs: ["Base", "Blue Box", "Green Box"], ...props },
    global: { stubs },
  });
}

describe("AdminPackPicker", () => {
  it("suggests every pack when nothing is typed", () => {
    const wrapper = mountPicker();
    expect(wrapper.vm.suggestions).toEqual(["Base", "Blue Box", "Green Box"]);
  });

  it("filters suggestions case-insensitively as you type", async () => {
    const wrapper = mountPicker({ modelValue: "box" });
    expect(wrapper.vm.suggestions).toEqual(["Blue Box", "Green Box"]);
  });

  it("omits excluded packs so a pack cannot be merged into itself", () => {
    const wrapper = mountPicker({ exclude: ["Base"] });
    expect(wrapper.vm.suggestions).toEqual(["Blue Box", "Green Box"]);
  });

  it("reports that a typed name is new when it matches no existing pack", async () => {
    const wrapper = mountPicker({ modelValue: "Brand New" });
    expect(wrapper.vm.isNewPack).toBe(true);
  });

  it("does not call an exact existing match new, ignoring case", async () => {
    const wrapper = mountPicker({ modelValue: "base" });
    expect(wrapper.vm.isNewPack).toBe(false);
  });

  it("treats a blank value as neither new nor valid", () => {
    const wrapper = mountPicker({ modelValue: "   " });
    expect(wrapper.vm.isNewPack).toBe(false);
  });

  it("emits the picked suggestion", async () => {
    const wrapper = mountPicker();
    await wrapper.vm.pick("Blue Box");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual(["Blue Box"]);
  });
});
