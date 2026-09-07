import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminPackTile from "~/components/admin/AdminPackTile.vue";

const pack = {
  name: "Base",
  black: { total: 500, active: 500 },
  white: { total: 735, active: 730 },
};
const dark = {
  name: "Old",
  black: { total: 10, active: 0 },
  white: { total: 20, active: 0 },
};

const mountTile = (props = {}) =>
  mount(AdminPackTile, { props: { pack, ...props } });

describe("AdminPackTile", () => {
  it("shows the display name when metadata supplies one", () => {
    const wrapper = mountTile({ meta: { pack: "Base", displayName: "CAH Base Set" } });
    expect(wrapper.text()).toContain("CAH Base Set");
  });

  it("falls back to the raw pack key with no metadata", () => {
    expect(mountTile().text()).toContain("Base");
  });

  it("shows both type counts", () => {
    const text = mountTile().text();
    expect(text).toContain("500");
    expect(text).toContain("735");
  });

  it("badges a default pack", () => {
    expect(mountTile({ isDefault: true }).text()).toMatch(/default/i);
  });

  it("marks a pack with nothing active", () => {
    expect(mountTile({ pack: dark }).text()).toMatch(/inactive/i);
  });

  it("emits open when the body is clicked and toggle-select from the checkbox", async () => {
    const wrapper = mountTile();
    await wrapper.find('[data-testid="pack-open"]').trigger("click");
    expect(wrapper.emitted("open")).toHaveLength(1);
    await wrapper.find('[data-testid="pack-select"]').trigger("click");
    expect(wrapper.emitted("toggle-select")).toHaveLength(1);
    expect(wrapper.emitted("open")).toHaveLength(1);
  });

  it("emits rename after an inline edit", async () => {
    const wrapper = mountTile();
    await wrapper.find('[data-testid="pack-name"]').trigger("dblclick");
    const input = wrapper.find('[data-testid="pack-rename"]');
    await input.setValue("Renamed");
    await input.trigger("keydown.enter");
    expect(wrapper.emitted("rename")?.at(-1)).toEqual(["Renamed"]);
  });
});
