import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
vi.unmock("vue");

const gsapSet = vi.fn();
vi.mock("gsap", () => ({
  gsap: {
    killTweensOf: vi.fn(),
    timeline: vi.fn(() => ({ to: vi.fn() })),
    set: (...args: unknown[]) => gsapSet(...args),
  },
}));

(globalThis as any).useCrypto = () => ({ getRandomInRange: (a: number) => a });
(globalThis as any).useSfx = () => ({ playSfx: vi.fn() });
(globalThis as any).useVibrate = () => ({ vibrate: vi.fn() });
(globalThis as any).useDevice = () => ({ isMobile: false });
(globalThis as any).useFitText = () => {};
(globalThis as any).hyphenateCardText = (t: string) => t;
(globalThis as any).glueOrphanPunctuation = (t: string) => t;

import WhiteCard from "~/components/game/WhiteCard.vue";

describe("WhiteCard.vue — picture cards", () => {
  const mountCard = (props: Record<string, any> = {}) =>
    mount(WhiteCard, {
      props: { disableHover: true, ...props },
      global: { stubs: { UPopover: true, UModal: true, UButton: true, ReportCard: true, Icon: true } },
    });

  it("renders body text when no imageUrl is given", () => {
    const wrapper = mountCard({ text: "A funny answer." });
    expect(wrapper.find(".card-body-text").text()).toContain("A funny answer.");
    expect(wrapper.find(".card-image").exists()).toBe(false);
  });

  it("renders a full-bleed image and hides the text body when imageUrl is set", () => {
    const wrapper = mountCard({ imageUrl: "/api/cards/images/doge.webp" });
    expect(wrapper.find(".card-image").exists()).toBe(true);
    expect(wrapper.find(".card-image").attributes("src")).toBe("/api/cards/images/doge.webp");
    expect(wrapper.find(".card-body-text").exists()).toBe(false);
  });

  it("applies the attachment offset/scale as a CSS transform on the image", () => {
    const wrapper = mountCard({
      imageUrl: "/api/cards/images/doge.webp",
      attachment: { offsetX: 0.25, offsetY: -0.1, scale: 1.5 },
    });
    expect(wrapper.find(".card-image").attributes("style")).toContain(
      "translate(25%, -10%) scale(1.5)",
    );
  });

  it("defaults to no pan/zoom when an image card has no attachment config", () => {
    const wrapper = mountCard({ imageUrl: "/api/cards/images/doge.webp" });
    expect(wrapper.find(".card-image").attributes("style")).toContain(
      "translate(0%, 0%) scale(1)",
    );
  });
});

describe("WhiteCard.vue — initial flip state", () => {
  const mountCard = (props: Record<string, any> = {}) =>
    mount(WhiteCard, {
      props: { text: "A funny answer.", disableHover: true, ...props },
      global: { stubs: { UPopover: true, UModal: true, UButton: true, ReportCard: true, Icon: true } },
    });

  beforeEach(() => gsapSet.mockClear());

  // The 3D path had the same split BlackCard was mounting face-up from: the
  // flip was a CSS class on `.card`, which the hover tilt's inline transform
  // outranks, plus a watcher that only fires on *change*. It survived only
  // because resetTransform() here bails on disableHover and the one unflatted
  // caller pairs the two props — coupling nothing enforces.
  it("presents its back face when mounted already flipped in 3D mode", () => {
    const wrapper = mountCard({ flipped: true });

    const inner = wrapper.find(".card__inner").element;
    expect(gsapSet).toHaveBeenCalledWith(inner, { rotateY: 180 });
  });

  it("presents its front face when mounted unflipped in 3D mode", () => {
    const wrapper = mountCard({ flipped: false });

    const inner = wrapper.find(".card__inner").element;
    expect(gsapSet).toHaveBeenCalledWith(inner, { rotateY: 0 });
  });

  // Flat mode swaps the faces by rendering them, so it must stay unrotated —
  // a transform there mirrors the card instead of flipping it.
  it("renders the back face directly in flat mode, with no rotation", () => {
    const wrapper = mountCard({ flipped: true, flat: true });

    expect(wrapper.find(".card__back").exists()).toBe(true);
    expect(wrapper.find(".card__front").exists()).toBe(false);
    expect(gsapSet).not.toHaveBeenCalled();
  });
});
