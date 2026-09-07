import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminCardRail from "~/components/admin/AdminCardRail.vue";

const stubs = { NuxtLink: { props: ["to"], template: "<a><slot /></a>" } };

const packs = [
  { name: "Base", black: { total: 500, active: 500 }, white: { total: 735, active: 730 } },
  { name: "Blue", black: { total: 120, active: 0 }, white: { total: 300, active: 0 } },
];

const mountRail = (props = {}) =>
  mount(AdminCardRail, { props: { packs, ...props }, global: { stubs } });

describe("AdminCardRail", () => {
  it("lists each pack with its combined total", () => {
    const text = mountRail().text();
    expect(text).toContain("Base");
    expect(text).toContain("1,235");
    expect(text).toContain("420");
  });

  it("marks the current pack", () => {
    const wrapper = mountRail({ current: "Blue" });
    expect(wrapper.find('[data-testid="pack-Blue"]').attributes("aria-current")).toBe("true");
    expect(wrapper.find('[data-testid="pack-Base"]').attributes("aria-current")).toBe("false");
  });

  it("emits the pack name on click", async () => {
    const wrapper = mountRail();
    await wrapper.find('[data-testid="pack-Base"]').trigger("click");
    expect(wrapper.emitted("select")?.at(-1)).toEqual(["Base"]);
  });

  it("dims a pack with nothing active", () => {
    const wrapper = mountRail();
    expect(wrapper.find('[data-testid="pack-Blue"]').classes().join(" ")).toContain("opacity");
  });

  it("links back to the packs index", () => {
    expect(mountRail().text()).toMatch(/all packs/i);
  });
});
