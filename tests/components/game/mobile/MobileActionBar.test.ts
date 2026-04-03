// tests/components/game/mobile/MobileActionBar.test.ts
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
vi.unmock("vue");

import MobileActionBar from "~/components/game/mobile/MobileActionBar.vue";

describe("MobileActionBar.vue", () => {
  const defaultProps = {
    phase: "submitting",
    isJudge: false,
    selectedCount: 0,
    requiredCount: 1,
    allRevealed: false,
    hasSubmitted: false,
    winnerSelected: false,
  };

  // 1. Shows "Select 1 more card" when no cards selected during submitting
  it('shows "Select 1 more card" when no cards selected during submitting', () => {
    const wrapper = mount(MobileActionBar, {
      props: { ...defaultProps, selectedCount: 0, requiredCount: 1 },
    });
    expect(wrapper.text()).toContain("Select 1 more card");
  });

  // 2. Shows "Submit Cards" when enough cards selected
  it('shows "Submit Cards" when enough cards selected', () => {
    const wrapper = mount(MobileActionBar, {
      props: { ...defaultProps, selectedCount: 1, requiredCount: 1 },
    });
    expect(wrapper.text()).toContain("Submit Cards");
  });

  // 3. Shows "Select 2 more cards" for Pick 2 with none selected
  it('shows "Select 2 more cards" for Pick 2 with none selected', () => {
    const wrapper = mount(MobileActionBar, {
      props: { ...defaultProps, selectedCount: 0, requiredCount: 2 },
    });
    expect(wrapper.text()).toContain("Select 2 more cards");
  });

  // 4. Shows "Waiting for others..." after submitting
  it('shows "Waiting for others..." after submitting', () => {
    const wrapper = mount(MobileActionBar, {
      props: { ...defaultProps, hasSubmitted: true },
    });
    expect(wrapper.text()).toContain("Waiting for others...");
  });

  // 5. Shows "Waiting for players..." when judge during submitting
  it('shows "Waiting for players..." when judge during submitting', () => {
    const wrapper = mount(MobileActionBar, {
      props: { ...defaultProps, isJudge: true },
    });
    expect(wrapper.text()).toContain("Waiting for players...");
  });

  // 6. Shows "Reveal all cards first" during judging before all revealed
  it('shows "Reveal all cards first" during judging before all revealed', () => {
    const wrapper = mount(MobileActionBar, {
      props: {
        ...defaultProps,
        phase: "judging",
        isJudge: true,
        allRevealed: false,
      },
    });
    expect(wrapper.text()).toContain("Reveal all cards first");
  });

  // 7. Shows "Pick a winner" when all revealed and judge
  it('shows "Pick a winner" when all revealed and judge', () => {
    const wrapper = mount(MobileActionBar, {
      props: {
        ...defaultProps,
        phase: "judging",
        isJudge: true,
        allRevealed: true,
        winnerSelected: false,
      },
    });
    expect(wrapper.text()).toContain("Pick a winner");
  });

  // 8. Shows "Waiting for judge..." for non-judge during judging
  it('shows "Waiting for judge..." for non-judge during judging', () => {
    const wrapper = mount(MobileActionBar, {
      props: {
        ...defaultProps,
        phase: "judging",
        isJudge: false,
      },
    });
    expect(wrapper.text()).toContain("Waiting for judge...");
  });

  // 9. Shows "Continue" during roundEnd
  it('shows "Continue" during roundEnd', () => {
    const wrapper = mount(MobileActionBar, {
      props: { ...defaultProps, phase: "roundEnd" },
    });
    expect(wrapper.text()).toContain("Continue");
  });

  // 10. Emits submit when submit button clicked
  it("emits submit when submit button clicked", async () => {
    const wrapper = mount(MobileActionBar, {
      props: { ...defaultProps, selectedCount: 1, requiredCount: 1 },
    });
    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("submit")).toBeTruthy();
  });

  // 11. Emits continue when continue button clicked
  it("emits continue when continue button clicked", async () => {
    const wrapper = mount(MobileActionBar, {
      props: { ...defaultProps, phase: "roundEnd" },
    });
    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("continue")).toBeTruthy();
  });
});
