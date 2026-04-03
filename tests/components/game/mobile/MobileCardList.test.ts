import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@vueuse/core", () => ({
  useParallax: () => ({
    tilt: { value: 0 },
    roll: { value: 0 },
    source: { value: "mouse" },
  }),
}));

vi.mock("gsap", () => ({
  default: {
    to: vi.fn(),
    fromTo: vi.fn(),
    set: vi.fn(),
    timeline: vi.fn(() => ({ to: vi.fn() })),
  },
  gsap: {
    to: vi.fn(),
    fromTo: vi.fn(),
    set: vi.fn(),
    timeline: vi.fn(() => ({ to: vi.fn() })),
  },
}));
vi.unmock("vue");

import MobileCardList from "~/components/game/mobile/MobileCardList.vue";

const CARD_TEXTS = {
  c1: { text: "A Roomba that judges your lifestyle", pack: "base" },
  c2: { text: "Another streaming service", pack: "base" },
  c3: { text: "Sentient AI", pack: "base" },
  c4: { text: "Blockchain for pets", pack: "base" },
};

const defaultSelectProps = {
  mode: "select" as const,
  cards: ["c1", "c2", "c3"],
  maxPicks: 1,
  selectedCards: [],
  submissions: {},
  revealedCards: {},
  isJudge: false,
  allRevealed: false,
  cardTexts: CARD_TEXTS,
};

const defaultJudgeProps = {
  mode: "judge" as const,
  cards: [],
  maxPicks: 1,
  selectedCards: [],
  submissions: {
    player1: ["c1"],
    player2: ["c2"],
  },
  revealedCards: {
    player1: false,
    player2: false,
  },
  isJudge: true,
  allRevealed: false,
  cardTexts: CARD_TEXTS,
};

// ────────────────────────────────────────────────────────────────────────────────
// SELECT MODE TESTS
// ────────────────────────────────────────────────────────────────────────────────

describe("MobileCardList — select mode", () => {
  // 1. Renders cards with their text
  it("renders cards with their text", () => {
    const wrapper = mount(MobileCardList, { props: defaultSelectProps });
    expect(wrapper.text()).toContain("A Roomba that judges your lifestyle");
    expect(wrapper.text()).toContain("Another streaming service");
    expect(wrapper.text()).toContain("Sentient AI");
  });

  // 2. Renders correct number of card elements
  it("renders correct number of card elements", () => {
    const wrapper = mount(MobileCardList, { props: defaultSelectProps });
    const cards = wrapper.findAll("[data-testid='select-card']");
    expect(cards.length).toBe(3);
  });

  // 3. Emits select when a card is tapped
  it("emits select when a card is tapped", async () => {
    const wrapper = mount(MobileCardList, { props: defaultSelectProps });
    const cards = wrapper.findAll("[data-testid='select-card']");
    await cards[0].trigger("click");
    expect(wrapper.emitted("select")).toBeTruthy();
    expect(wrapper.emitted("select")![0]).toEqual(["c1"]);
  });

  // 4. Shows selection badge on selected cards
  it("shows selection badge on selected cards", () => {
    const wrapper = mount(MobileCardList, {
      props: { ...defaultSelectProps, selectedCards: ["c1"] },
    });
    const badge = wrapper.find("[data-testid='selection-badge']");
    expect(badge.exists()).toBe(true);
  });

  // 5. Shows numbered badges for multi-pick
  it("shows numbered badges for multi-pick selections", () => {
    const wrapper = mount(MobileCardList, {
      props: {
        ...defaultSelectProps,
        maxPicks: 2,
        selectedCards: ["c1", "c2"],
      },
    });
    const badges = wrapper.findAll("[data-testid='selection-badge']");
    expect(badges.length).toBe(2);
    expect(badges[0].text()).toBe("1");
    expect(badges[1].text()).toBe("2");
  });

  // 6. Applies selected glow to selected cards
  it("applies selected glow style to selected cards", () => {
    const wrapper = mount(MobileCardList, {
      props: { ...defaultSelectProps, selectedCards: ["c2"] },
    });
    const cards = wrapper.findAll("[data-testid='select-card']");
    // The second card (c2) should have a boxShadow applied
    const selectedCard = cards[1];
    expect(selectedCard.attributes("style")).toContain("box-shadow");
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// JUDGE MODE TESTS
// ────────────────────────────────────────────────────────────────────────────────

describe("MobileCardList — judge mode", () => {
  // 1. Renders submission groups
  it("renders submission groups", () => {
    const wrapper = mount(MobileCardList, { props: defaultJudgeProps });
    const groups = wrapper.findAll("[data-testid='submission-group']");
    expect(groups.length).toBe(2);
  });

  // 2. Shows "Tap to reveal" for unrevealed submissions
  it('shows "Tap to reveal" for unrevealed submissions', () => {
    const wrapper = mount(MobileCardList, { props: defaultJudgeProps });
    expect(wrapper.text()).toContain("Tap to reveal");
  });

  // 3. Shows card text for revealed submissions
  it("shows card text for revealed submissions", () => {
    const wrapper = mount(MobileCardList, {
      props: {
        ...defaultJudgeProps,
        revealedCards: { player1: true, player2: false },
      },
    });
    expect(wrapper.text()).toContain("A Roomba that judges your lifestyle");
  });

  // 4. Emits reveal when unrevealed submission tapped by judge
  it("emits reveal when unrevealed submission tapped by judge", async () => {
    const wrapper = mount(MobileCardList, { props: defaultJudgeProps });
    const groups = wrapper.findAll("[data-testid='submission-group']");
    await groups[0].trigger("click");
    expect(wrapper.emitted("reveal")).toBeTruthy();
    expect(wrapper.emitted("reveal")![0]).toEqual(["player1"]);
  });

  // 5. Emits pick-winner when revealed submission tapped and all revealed
  it("emits pick-winner when revealed submission tapped and allRevealed", async () => {
    const wrapper = mount(MobileCardList, {
      props: {
        ...defaultJudgeProps,
        revealedCards: { player1: true, player2: true },
        allRevealed: true,
      },
    });
    const groups = wrapper.findAll("[data-testid='submission-group']");
    await groups[0].trigger("click");
    expect(wrapper.emitted("pick-winner")).toBeTruthy();
    expect(wrapper.emitted("pick-winner")![0]).toEqual(["player1"]);
  });

  // 6. Groups multiple cards for Pick 2+ submissions
  it("groups multiple cards for Pick 2+ submissions", () => {
    const wrapper = mount(MobileCardList, {
      props: {
        ...defaultJudgeProps,
        submissions: { player1: ["c1", "c3"] },
        revealedCards: { player1: true },
        allRevealed: true,
      },
    });
    const group = wrapper.find("[data-testid='submission-group']");
    expect(group.text()).toContain("A Roomba that judges your lifestyle");
    expect(group.text()).toContain("Sentient AI");
  });

  // 7. Does not emit events for non-judge users
  it("does not emit events for non-judge users", async () => {
    const wrapper = mount(MobileCardList, {
      props: { ...defaultJudgeProps, isJudge: false },
    });
    const groups = wrapper.findAll("[data-testid='submission-group']");
    await groups[0].trigger("click");
    expect(wrapper.emitted("reveal")).toBeFalsy();
    expect(wrapper.emitted("pick-winner")).toBeFalsy();
  });
});
