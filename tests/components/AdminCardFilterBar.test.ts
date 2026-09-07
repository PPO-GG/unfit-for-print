import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminCardFilterBar from "~/components/admin/AdminCardFilterBar.vue";

const stubs = {
  UInput: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
  USelectMenu: {
    props: ["modelValue", "items"],
    emits: ["update:modelValue"],
    template: `<select @change="$emit('update:modelValue', $event.target.value)"></select>`,
  },
};

const counts = { all: 1235, white: 735, black: 500, inactive: 12 };

function mountBar(props = {}) {
  return mount(AdminCardFilterBar, {
    props: { filter: "all", search: "", sort: "pack", counts, ...props },
    global: { stubs },
  });
}

describe("AdminCardFilterBar", () => {
  it("shows a count on every chip", () => {
    const text = mountBar().text();
    expect(text).toContain("1235");
    expect(text).toContain("735");
    expect(text).toContain("500");
    expect(text).toContain("12");
  });

  it("marks the active filter", () => {
    const wrapper = mountBar({ filter: "black" });
    const chip = wrapper.find('[data-testid="chip-black"]');
    expect(chip.attributes("aria-pressed")).toBe("true");
    expect(wrapper.find('[data-testid="chip-white"]').attributes("aria-pressed")).toBe("false");
  });

  it("emits the chosen filter", async () => {
    const wrapper = mountBar();
    await wrapper.find('[data-testid="chip-white"]').trigger("click");
    expect(wrapper.emitted("update:filter")?.at(-1)).toEqual(["white"]);
  });

  it("treats inactive as a filter of its own", async () => {
    const wrapper = mountBar();
    await wrapper.find('[data-testid="chip-inactive"]').trigger("click");
    expect(wrapper.emitted("update:filter")?.at(-1)).toEqual(["inactive"]);
  });

  it("emits search text as it is typed", async () => {
    const wrapper = mountBar();
    await wrapper.find("input").setValue("safe word");
    expect(wrapper.emitted("update:search")?.at(-1)).toEqual(["safe word"]);
  });
});
