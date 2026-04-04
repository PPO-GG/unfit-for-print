import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import AvatarDecoration from "~/components/decorations/AvatarDecoration.vue";

// Mock the registry
vi.mock("~/utils/decorations", () => ({
  decorationRegistry: {
    "test-decoration": {
      component: () =>
        Promise.resolve({
          default: defineComponent({
            name: "TestDecoration",
            props: { size: String },
            setup(props, { slots }) {
              return () =>
                h("div", { class: "test-decoration" }, slots.default?.());
            },
          }),
        }),
      name: "Test",
      description: "Test decoration",
      type: "ring",
      rarity: "common",
    },
  },
}));

describe("AvatarDecoration", () => {
  it("renders slot directly when no decorationId", () => {
    const wrapper = mount(AvatarDecoration, {
      props: { size: "sm" },
      slots: { default: '<img src="avatar.png" />' },
    });
    expect(wrapper.find("img").exists()).toBe(true);
    expect(wrapper.find(".test-decoration").exists()).toBe(false);
  });

  it("renders slot directly when decorationId is not in registry", () => {
    const wrapper = mount(AvatarDecoration, {
      props: { decorationId: "nonexistent", size: "sm" },
      slots: { default: '<img src="avatar.png" />' },
    });
    expect(wrapper.find("img").exists()).toBe(true);
  });

  it("renders decoration component when valid decorationId", async () => {
    const wrapper = mount(AvatarDecoration, {
      props: { decorationId: "test-decoration", size: "sm" },
      slots: { default: '<img src="avatar.png" />' },
    });
    // Wait for async component to resolve
    await new Promise(r => setTimeout(r, 50));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".test-decoration").exists()).toBe(true);
    expect(wrapper.find("img").exists()).toBe(true);
  });
});
