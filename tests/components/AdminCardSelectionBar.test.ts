import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminCardSelectionBar from "~/components/admin/AdminCardSelectionBar.vue";

const stubs = {
  UButton: { template: "<button><slot /></button>" },
  UPopover: { template: "<div><slot /><slot name='content' /></div>" },
  AdminPackPicker: {
    props: ["modelValue", "packs", "exclude"],
    template: "<div class='picker'></div>",
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

  it("emits move with the picked destination", async () => {
    const wrapper = mountBar();
    wrapper.vm.target = "Blue";
    await wrapper.vm.confirmMove();
    expect(wrapper.emitted("move")?.at(-1)).toEqual(["Blue"]);
  });

  it("refuses to emit move for a blank destination", async () => {
    const wrapper = mountBar();
    wrapper.vm.target = "   ";
    await wrapper.vm.confirmMove();
    expect(wrapper.emitted("move")).toBeUndefined();
  });

  it("emits clear", async () => {
    const wrapper = mountBar();
    await wrapper.find('[data-testid="clear"]').trigger("click");
    expect(wrapper.emitted("clear")).toHaveLength(1);
  });
});
