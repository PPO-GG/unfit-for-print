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

  it("emits rename exactly once when Enter is followed by the blur it causes", async () => {
    const wrapper = mountTile();
    await wrapper.find('[data-testid="pack-name"]').trigger("dblclick");
    const input = wrapper.find('[data-testid="pack-rename"]');
    await input.setValue("Renamed");
    await input.trigger("keydown.enter");
    // Chrome fires blur when the focused input is removed from the DOM, so
    // the same commit path is reached twice — two racing renamePack calls.
    await input.trigger("blur");
    expect(wrapper.emitted("rename")).toHaveLength(1);
  });

  it("does not rename when the edit is abandoned with Escape", async () => {
    const wrapper = mountTile();
    await wrapper.find('[data-testid="pack-name"]').trigger("dblclick");
    const input = wrapper.find('[data-testid="pack-rename"]');
    await input.setValue("Typed but abandoned");
    await input.trigger("keydown.esc");
    // Escape closes the editor, and its removal fires blur — which used to
    // commit whatever had been typed.
    await input.trigger("blur");
    expect(wrapper.emitted("rename")).toBeUndefined();
  });

  it("keeps the checkbox and name above the open overlay", () => {
    const wrapper = mountTile();
    for (const id of ["pack-select", "pack-name"]) {
      expect(wrapper.find(`[data-testid="${id}"]`).classes()).toContain("z-10");
    }
    expect(wrapper.find('[data-testid="pack-open"]').classes()).toContain("z-0");
  });
});

describe("AdminPackTile — lobby-card treatment", () => {
  const prefix = "Cards Against Humanity:";

  it("splits the series prefix away from the distinguishing name", () => {
    const wrapper = mount(AdminPackTile, {
      props: {
        pack: { ...pack, name: "Cards Against Humanity: Blue Box Expansion" },
        seriesPrefix: prefix,
      },
    });
    expect(wrapper.find('[data-testid="pack-series"]').text()).toBe(prefix);
    expect(wrapper.find('[data-testid="pack-name"]').text()).toBe(
      "Blue Box Expansion",
    );
  });

  it("shows no series line for a pack outside the series", () => {
    const wrapper = mount(AdminPackTile, {
      props: { pack: { ...pack, name: "Unfit Labs" }, seriesPrefix: prefix },
    });
    expect(wrapper.find('[data-testid="pack-series"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="pack-name"]').text()).toBe("Unfit Labs");
  });

  it("prefers an explicit display name over the derived split", () => {
    const wrapper = mount(AdminPackTile, {
      props: {
        pack: { ...pack, name: "Cards Against Humanity: Hot Box" },
        meta: { pack: "x", displayName: "The Hot One" },
        seriesPrefix: prefix,
      },
    });
    expect(wrapper.find('[data-testid="pack-name"]').text()).toBe("The Hot One");
  });

  it("prefers an explicit meta.series over the derived prefix", () => {
    const wrapper = mount(AdminPackTile, {
      props: {
        pack: { ...pack, name: "Cards Against Humanity: Blue Box Expansion" },
        meta: { pack: "x", series: "CAH" },
        seriesPrefix: prefix,
      },
    });
    expect(wrapper.find('[data-testid="pack-series"]').text()).toBe("CAH");
  });

  it("still shows an explicit meta.series alongside a custom display name", () => {
    const wrapper = mount(AdminPackTile, {
      props: {
        pack: { ...pack, name: "Cards Against Humanity: Hot Box" },
        meta: { pack: "x", displayName: "The Hot One", series: "CAH" },
        seriesPrefix: prefix,
      },
    });
    expect(wrapper.find('[data-testid="pack-series"]').text()).toBe("CAH");
    expect(wrapper.find('[data-testid="pack-name"]').text()).toBe("The Hot One");
  });

  it("derives a stable accent colour when the pack has none", () => {
    const mountFor = (name: string) =>
      mount(AdminPackTile, { props: { pack: { ...pack, name } } });
    const a = mountFor("Alpha").find('[data-testid="pack-accent"]').attributes("style");
    const again = mountFor("Alpha").find('[data-testid="pack-accent"]').attributes("style");
    const b = mountFor("Beta").find('[data-testid="pack-accent"]').attributes("style");
    expect(a).toBe(again);
    expect(a).not.toBe(b);
  });

  it("lets a real colour override the derived one", () => {
    const wrapper = mount(AdminPackTile, {
      props: { pack, meta: { pack: "x", color: "#ff0000" } },
    });
    expect(
      wrapper.find('[data-testid="pack-accent"]').attributes("style"),
    ).toContain("rgb(255, 0, 0)");
  });

  it("shows the description when one is set", () => {
    const wrapper = mount(AdminPackTile, {
      props: { pack, meta: { pack: "x", description: "The original 500." } },
    });
    expect(wrapper.text()).toContain("The original 500.");
  });

  it("reports inactive cards when a pack is partly switched off", () => {
    const wrapper = mount(AdminPackTile, {
      props: {
        pack: {
          name: "Base",
          black: { total: 500, active: 500 },
          white: { total: 735, active: 723 },
        },
      },
    });
    expect(wrapper.text()).toContain("12 inactive");
  });

  it("says nothing about inactive cards when the whole pack is live", () => {
    const wrapper = mount(AdminPackTile, {
      props: {
        pack: {
          name: "Base",
          black: { total: 500, active: 500 },
          white: { total: 735, active: 735 },
        },
      },
    });
    expect(wrapper.text()).not.toContain("inactive");
  });
});
