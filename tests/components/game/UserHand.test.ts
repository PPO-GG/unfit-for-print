// tests/components/game/UserHand.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import UserHand from "~/components/game/UserHand.vue";

(globalThis as any).useI18n = () => ({ t: (key: string) => key });
vi.mock("~/composables/useCompactLayout", () => ({
  useCompactLayout: () => ({
    isCompact: ref(false),
    orientation: ref("landscape"),
    width: ref(1280),
    height: ref(800),
  }),
}));

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

  describe("manual draw slots", () => {
    const stubs = { WhiteCard: true, UButton: true, Icon: true };

    it("shows one dashed slot per card the player can draw", () => {
      wrapper = mount(UserHand, {
        props: { cards: ["c1", "c2", "c3"], drawSlots: 7 },
        global: { stubs },
      });

      expect(wrapper.findAll(".hand-card").length).toBe(3);
      expect(wrapper.findAll(".hand-slot").length).toBe(7);
    });

    it("shows none when there is nothing to draw", () => {
      wrapper = mount(UserHand, {
        props: { cards: ["c1", "c2", "c3"] },
        global: { stubs },
      });

      expect(wrapper.findAll(".hand-slot").length).toBe(0);
    });

    it("draws when a slot is tapped, without selecting a card", async () => {
      wrapper = mount(UserHand, {
        props: { cards: ["c1", "c2"], drawSlots: 2 },
        global: { stubs },
      });

      await wrapper.find(".hand-slot").trigger("click");

      expect(wrapper.emitted("draw")).toHaveLength(1);
      expect(wrapper.findAll(".hand-card--selected").length).toBe(0);
    });

    // The fan is laid out for the full hand, so drawn cards land in the gaps
    // they fill instead of the whole fan reshuffling around them.
    it("lays the fan out for the full hand, gaps included", () => {
      const short = mount(UserHand, {
        props: { cards: ["c1", "c2", "c3"], drawSlots: 7 },
        global: { stubs },
      });
      const full = mount(UserHand, {
        props: { cards: Array.from({ length: 10 }, (_, i) => `c${i}`) },
        global: { stubs },
      });

      expect(short.vm.getBaseTransform(0)).toEqual(full.vm.getBaseTransform(0));
      expect(short.vm.getBaseTransform(9)).toEqual(full.vm.getBaseTransform(9));
    });
  });
});
