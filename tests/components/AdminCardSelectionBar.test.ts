import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminCardSelectionBar from "~/components/admin/AdminCardSelectionBar.vue";

const stubs = {
  UButton: { template: "<button><slot /></button>" },
  UPopover: { template: "<div><slot /><slot name='content' /></div>" },
  AdminPackPicker: {
    props: ["modelValue", "packs", "exclude"],
    emits: ["update:modelValue"],
    template: `<button class="picker" @click="$emit('update:modelValue', packs[1])">pick</button>`,
  },
};

function mountBar(props = {}) {
  return mount(AdminCardSelectionBar, {
    props: { count: 3, totalLoaded: 1235, packs: ["Base", "Blue"], ...props },
    global: { stubs },
  });
}

describe("AdminCardSelectionBar", () => {
  it("states how many are selected", () => {
    expect(mountBar().text()).toContain("3 selected");
  });

  it("offers select-all only while some remain unselected", () => {
    expect(mountBar().text()).toContain("Select all 1,235");
    const all = mountBar({ count: 1235, totalLoaded: 1235 });
    expect(all.text()).not.toContain("Select all");
  });

  it("emits deactivate, delete and select-all from their buttons", async () => {
    const wrapper = mountBar();
    await wrapper.find('[data-testid="deactivate"]').trigger("click");
    await wrapper.find('[data-testid="delete"]').trigger("click");
    await wrapper.find('[data-testid="select-all"]').trigger("click");
    expect(wrapper.emitted("deactivate")).toHaveLength(1);
    expect(wrapper.emitted("delete")).toHaveLength(1);
    expect(wrapper.emitted("select-all")).toHaveLength(1);
  });

  it("moves to the destination chosen through the picker, not an internal setter", async () => {
    const wrapper = mountBar();
    await wrapper.find(".picker").trigger("click"); // picker emits packs[1] === "Blue"
    await wrapper.find('[data-testid="move-confirm"]').trigger("click");
    expect(wrapper.emitted("move")?.at(-1)).toEqual(["Blue"]);
  });

  it("does not emit move while the destination is untouched", async () => {
    const wrapper = mountBar();
    await wrapper.find('[data-testid="move-confirm"]').trigger("click");
    expect(wrapper.emitted("move")).toBeUndefined();
  });

  it("emits clear", async () => {
    const wrapper = mountBar();
    await wrapper.find('[data-testid="clear"]').trigger("click");
    expect(wrapper.emitted("clear")).toHaveLength(1);
  });
});
