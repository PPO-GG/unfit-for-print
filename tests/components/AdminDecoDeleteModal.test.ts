import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminDecoDeleteModal from "~/components/admin/AdminDecoDeleteModal.vue";

const stubs = {
  UModal: { props: ["open"], template: '<div v-if="open"><slot name="content" /></div>' },
  UButton: { template: '<button v-bind="$attrs"><slot /></button>' },
  UInput: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<input v-bind="$attrs" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
};

describe("AdminDecoDeleteModal", () => {
  it("states the owner count and only confirms once the name is typed", async () => {
    const w = mount(AdminDecoDeleteModal, { props: { open: true, name: "Gold Ring", ownerCount: 14 }, global: { stubs } });
    expect(w.text()).toContain("14");
    await w.find('[data-testid="delete-confirm"]').trigger("click");
    expect(w.emitted("confirm")).toBeUndefined();
    await w.find('[data-testid="delete-confirm-input"]').setValue("Gold Ring");
    await w.find('[data-testid="delete-confirm"]').trigger("click");
    expect(w.emitted("confirm")).toHaveLength(1);
  });

  it("offers Hide instead", async () => {
    const w = mount(AdminDecoDeleteModal, { props: { open: true, name: "X", ownerCount: 2 }, global: { stubs } });
    await w.find('[data-testid="delete-hide"]').trigger("click");
    expect(w.emitted("hide")).toHaveLength(1);
  });
});
