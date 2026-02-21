// tests/components/game/UserHand.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import UserHand from "~/components/game/UserHand.vue";

// Mock the useSfx composable
vi.mock("~/composables/useSfx", () => ({
  useSfx: () => ({
    playSfx: vi.fn(),
  }),
}));

// Mock GSAP
vi.mock("gsap", () => ({
  gsap: {
    to: vi.fn(),
    set: vi.fn(),
    fromTo: vi.fn(),
  },
}));

vi.unmock("vue");

describe("UserHand.vue", () => {
  let wrapper: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the correct number of cards", () => {
    const cards = ["card1", "card2", "card3"];
    wrapper = mount(UserHand, {
      props: { cards, disabled: false, cardsToSelect: 1 },
      global: { stubs: { WhiteCard: true, UButton: true } },
    });

    const cardElements = wrapper.findAll(".hand-card");
    expect(cardElements.length).toBe(cards.length);
  });

  it("selects a card and shows selection state", async () => {
    const cards = ["card1", "card2", "card3"];
    wrapper = mount(UserHand, {
      props: { cards, disabled: false, cardsToSelect: 2 },
      global: { stubs: { WhiteCard: true, UButton: true } },
    });

    wrapper.vm.toggleCardSelection("card1", 0);
    await wrapper.vm.$nextTick();

    const selected = wrapper.findAll(".hand-card--selected");
    expect(selected.length).toBe(1);
  });

  it("disables card selection when disabled prop is true", async () => {
    const cards = ["card1", "card2", "card3"];
    wrapper = mount(UserHand, {
      props: { cards, disabled: true, cardsToSelect: 1 },
      global: { stubs: { WhiteCard: true, UButton: true } },
    });

    wrapper.vm.onCardClick(new MouseEvent("click"), "card1", 0);
    await wrapper.vm.$nextTick();

    const selected = wrapper.findAll(".hand-card--selected");
    expect(selected.length).toBe(0);
  });
});
