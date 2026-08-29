import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import MenuTile from "~/components/MenuTile.vue";

describe("MenuTile", () => {
  it("renders an optional description and keyboard shortcut", () => {
    const wrapper = mount(MenuTile, {
      props: {
        label: "New Game",
        icon: "i-solar-add-square-bold-duotone",
        description: "Start a fresh lobby",
        shortcut: "N",
      },
      global: {
        stubs: { UIcon: true },
        components: {
          NuxtLink: { template: "<a><slot /></a>" },
        },
      },
    });

    expect(wrapper.find(".menu-tile__description").text()).toBe("Start a fresh lobby");
    expect(wrapper.find(".menu-tile__shortcut").text()).toBe("N");
  });
});
