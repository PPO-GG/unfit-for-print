import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ScreenTitle from "~/components/ScreenTitle.vue";

describe("ScreenTitle", () => {
  it("renders the title as the page heading", () => {
    const wrapper = mount(ScreenTitle, { props: { title: "Lobby Monitor" } });

    expect(wrapper.find("h1.screen-title__heading").text()).toBe("Lobby Monitor");
  });

  it("renders the subtitle when given", () => {
    const wrapper = mount(ScreenTitle, {
      props: { title: "Upload Pack", subtitle: "Seed new card packs from a JSON file" },
    });

    expect(wrapper.find(".screen-title__subtitle").text()).toBe(
      "Seed new card packs from a JSON file",
    );
  });

  it("renders no subtitle when none is given", () => {
    const wrapper = mount(ScreenTitle, { props: { title: "Issues" } });

    expect(wrapper.find(".screen-title__subtitle").exists()).toBe(false);
  });

  it("renders extra heading content below the title", () => {
    const wrapper = mount(ScreenTitle, {
      props: { title: "Duplicate Scanner" },
      slots: { default: '<span class="scope">Scoped to 2 packs</span>' },
    });

    expect(wrapper.find(".screen-title .scope").text()).toBe("Scoped to 2 packs");
  });
});

describe("ScreenTitle before it can measure", () => {
  it("pads for the back button on the first render", () => {
    const wrapper = mount(ScreenTitle, { props: { title: "Upload Pack" } });

    expect(wrapper.find(".screen-title").attributes("style")).toContain("var(--screen-back-right");
  });
});
