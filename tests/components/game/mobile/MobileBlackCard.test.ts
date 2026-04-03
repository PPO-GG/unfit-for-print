import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
vi.unmock("vue");

import MobileBlackCard from "~/components/game/mobile/MobileBlackCard.vue";

describe("MobileBlackCard", () => {
  const mountCard = (props: Record<string, any> = {}) =>
    mount(MobileBlackCard, {
      props: {
        text: "What's the next big thing in tech?",
        pick: 1,
        selectedTexts: [],
        playersWaiting: 0,
        ...props,
      },
      global: {
        stubs: { Icon: true },
      },
    });

  it("renders the black card text", () => {
    const wrapper = mountCard();
    expect(wrapper.text()).toContain("What's the next big thing in tech?");
  });

  it("shows PICK badge when pick > 1", () => {
    const wrapper = mountCard({ pick: 2 });
    expect(wrapper.text()).toContain("PICK 2");
  });

  it("does not show PICK badge when pick is 1", () => {
    const wrapper = mountCard({ pick: 1 });
    expect(wrapper.text()).not.toContain("PICK");
  });

  it("renders unfilled blanks as dashed underlines", () => {
    const wrapper = mountCard({ text: "_ is the next _", pick: 2 });
    const blanks = wrapper.findAll(".mobile-black-card__blank");
    expect(blanks.length).toBe(2);
  });

  it("fills blanks with selected card text", () => {
    const wrapper = mountCard({
      text: "_ is the next _",
      pick: 2,
      selectedTexts: ["AI"],
    });
    const fills = wrapper.findAll(".mobile-black-card__fill");
    expect(fills.length).toBe(1);
    expect(fills[0].text()).toBe("AI");
    const blanks = wrapper.findAll(".mobile-black-card__blank");
    expect(blanks.length).toBe(1);
  });

  it("fills both blanks when two cards selected", () => {
    const wrapper = mountCard({
      text: "_ is the next _",
      pick: 2,
      selectedTexts: ["AI", "blockchain"],
    });
    const fills = wrapper.findAll(".mobile-black-card__fill");
    expect(fills.length).toBe(2);
    expect(fills[0].text()).toBe("AI");
    expect(fills[1].text()).toBe("blockchain");
  });

  it("shows players waiting count", () => {
    const wrapper = mountCard({ playersWaiting: 3 });
    expect(wrapper.text()).toContain("3 players waiting");
  });

  it("shows singular 'player' for count of 1", () => {
    const wrapper = mountCard({ playersWaiting: 1 });
    expect(wrapper.text()).toContain("1 player waiting");
    expect(wrapper.text()).not.toContain("players");
  });
});
