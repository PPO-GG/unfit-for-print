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

  it("shows a custom display name instead of the raw pack key", () => {
    const wrapper = mountRail({
      packMeta: { Base: { pack: "Base", displayName: "Base Set" } },
    });
    const label = wrapper.find('[data-testid="pack-Base"] span');
    expect(label.text()).toBe("Base Set");
    // The raw key is still available on hover, since it's the real identifier.
    expect(label.attributes("title")).toBe("Base");
  });

  it("falls back to the raw pack key when no display name is set", () => {
    const wrapper = mountRail({ packMeta: { Base: { pack: "Base" } } });
    expect(wrapper.find('[data-testid="pack-Base"]').text()).toContain("Base");
  });

  it("shows an explicit series above the name", () => {
    const wrapper = mountRail({
      packMeta: {
        Base: {
          pack: "Base",
          displayName: "Base Set",
          series: "Cards Against Humanity",
        },
      },
    });
    const row = wrapper.find('[data-testid="pack-Base"]');
    expect(row.text()).toContain("Cards Against Humanity");
    expect(row.text()).toContain("Base Set");
  });

  it("derives the series from the shared prefix when none is set", () => {
    // The rail showed `displayName || pack` for its whole life, so 106 of the
    // 111 real packs truncated to the same "Cards Against Humanity…" and the
    // half that identified the pack was what got cut.
    const wrapper = mountRail({
      packs: [
        {
          name: "Cards Against Humanity: Hot Box",
          black: { total: 10, active: 10 },
          white: { total: 20, active: 20 },
        },
      ],
      seriesPrefix: "Cards Against Humanity:",
    });
    const row = wrapper.find('[data-testid="pack-Cards Against Humanity: Hot Box"]');
    // Colon-stripped, and stacked rather than composed inline — at 224px the
    // composed string truncates almost exactly where the raw key used to.
    expect(row.text()).toContain("Cards Against Humanity");
    expect(row.text()).toContain("Hot Box");
  });

  it("shows no series line for a pack with neither source", () => {
    const wrapper = mountRail({ seriesPrefix: "Cards Against Humanity:" });
    expect(wrapper.find('[data-testid="pack-Base"]').text()).not.toContain(
      "Cards Against Humanity",
    );
  });
});
