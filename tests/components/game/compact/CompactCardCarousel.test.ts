import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import * as Vue from "vue";

// Nuxt auto-imports Vue APIs; plain vitest needs them on globalThis.
Object.assign(globalThis, Vue);
// i18n stub: returns "key" or "key|{json params}" so assertions can see params.
(globalThis as any).useI18n = () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}|${JSON.stringify(params)}` : key,
});
(globalThis as any).useSfx = () => ({ playSfx: vi.fn() });
vi.mock("gsap", () => ({
  gsap: { to: vi.fn(), set: vi.fn(), fromTo: vi.fn(), killTweensOf: vi.fn(),
          timeline: vi.fn(() => ({ to: vi.fn().mockReturnThis(), fromTo: vi.fn().mockReturnThis() })) },
}));
vi.unmock("vue");

import CompactCardCarousel from "~/components/game/compact/CompactCardCarousel.vue";

const WhiteCard = {
  props: ["cardId", "text", "flipped"],
  template: '<div class="wc" :data-flipped="String(!!flipped)">{{ text }}</div>',
};
const stubs = { WhiteCard, Icon: true };
const texts = {
  w1: { text: "Haunted Roombas", pack: "core" },
  w2: { text: "Unsupervised brunch", pack: "core" },
  w3: { text: "A raccoon", pack: "core" },
} as any;

describe("CompactCardCarousel — select", () => {
  it("emits select and shows order badges for multi-pick", async () => {
    const w = mount(CompactCardCarousel, {
      props: { mode: "select", cardTexts: texts, cards: ["w1", "w2", "w3"], selected: ["w3", "w1"], showOrder: true },
      global: { stubs },
    });
    const slides = w.findAll("[data-slide]");
    expect(slides).toHaveLength(3);
    expect(slides[0]!.classes()).toContain("is-ringed");
    expect(slides[0]!.get(".compact-slide-badge").text()).toBe("2");
    expect(slides[2]!.get(".compact-slide-badge").text()).toBe("1");
    await slides[1]!.trigger("click");
    expect(w.emitted("select")).toEqual([["w2"]]);
  });

  it("does nothing when not interactive", async () => {
    const w = mount(CompactCardCarousel, {
      props: { mode: "select", cardTexts: texts, cards: ["w1"], interactive: false },
      global: { stubs },
    });
    await w.get("[data-slide]").trigger("click");
    expect(w.emitted("select")).toBeUndefined();
  });
});

describe("CompactCardCarousel — judge", () => {
  const judgeProps = {
    mode: "judge" as const,
    cardTexts: texts,
    submissions: { p1: ["w1"], p2: ["w2"] },
    order: ["p1", "p2"],
  };

  it("reconnect mid-judging: revealed face-up, unrevealed face-down, nothing pre-picked", () => {
    const w = mount(CompactCardCarousel, {
      props: { ...judgeProps, revealed: { p1: true } },
      global: { stubs },
    });
    const [a, b] = w.findAll(".wc");
    expect(a!.attributes("data-flipped")).toBe("false");
    expect(b!.attributes("data-flipped")).toBe("true");
    expect(w.findAll(".is-ringed")).toHaveLength(0);
  });

  it("taps reveal a face-down card, then pick a face-up one", async () => {
    const w = mount(CompactCardCarousel, {
      props: { ...judgeProps, revealed: { p1: true } },
      global: { stubs },
    });
    const [a, b] = w.findAll("[data-slide]");
    await b!.trigger("click");
    expect(w.emitted("reveal")).toEqual([["p2"]]);
    await a!.trigger("click");
    expect(w.emitted("pick")).toEqual([["p1"]]);
  });

  it("tags the viewer's own submission and stays read-only for watchers", async () => {
    const w = mount(CompactCardCarousel, {
      props: { ...judgeProps, revealed: { p1: true, p2: true }, mine: "p2", interactive: false },
      global: { stubs },
    });
    const own = w.get('[data-slide="p2"]');
    expect(own.get(".compact-slide-mine").text()).toBe("compact.yours");
    await own.trigger("click");
    expect(w.emitted("pick")).toBeUndefined();
  });

  it("read-aloud button is only on face-up cards and does not also pick", async () => {
    const w = mount(CompactCardCarousel, {
      props: { ...judgeProps, revealed: { p1: true }, canReadAloud: true },
      global: { stubs },
    });
    expect(w.findAll(".compact-slide-speak")).toHaveLength(1);
    await w.get(".compact-slide-speak").trigger("click");
    expect(w.emitted("read-aloud")).toEqual([["p1"]]);
    expect(w.emitted("pick")).toBeUndefined();
  });
});
