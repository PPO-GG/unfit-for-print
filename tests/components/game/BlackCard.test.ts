import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
vi.unmock("vue");

vi.mock("gsap", () => ({
  gsap: { killTweensOf: vi.fn(), timeline: vi.fn(() => ({ to: vi.fn() })) },
}));

(globalThis as any).useCrypto = () => ({ getRandomInRange: (a: number) => a });
(globalThis as any).useSfx = () => ({ playSfx: vi.fn() });
(globalThis as any).useVibrate = () => ({ vibrate: vi.fn() });
(globalThis as any).useDevice = () => ({ isMobile: false });
(globalThis as any).useFitText = () => {};
(globalThis as any).hyphenateCardText = (t: string) => t;
(globalThis as any).glueOrphanPunctuation = (t: string) => t;

import BlackCard from "~/components/game/BlackCard.vue";

describe("BlackCard.vue — picture cards", () => {
  const mountCard = (props: Record<string, any> = {}) =>
    mount(BlackCard, {
      props: { text: "A prompt with _ blank.", numPick: 1, ...props },
      global: { stubs: { UPopover: true, UModal: true, UButton: true, ReportCard: true, Icon: true } },
    });

  it("renders body text when no imageUrl is given", () => {
    const wrapper = mountCard();
    expect(wrapper.find(".card-body-text").exists()).toBe(true);
    expect(wrapper.find(".card-image").exists()).toBe(false);
  });

  it("renders a full-bleed image and hides the text body when imageUrl is set", () => {
    const wrapper = mountCard({ text: undefined, imageUrl: "/api/cards/images/caption-this.webp" });
    expect(wrapper.find(".card-image").exists()).toBe(true);
    expect(wrapper.find(".card-image").attributes("src")).toBe(
      "/api/cards/images/caption-this.webp",
    );
    expect(wrapper.find(".card-body-text").exists()).toBe(false);
  });

  it("applies the attachment offset/scale as a CSS transform on the image", () => {
    const wrapper = mountCard({
      text: undefined,
      imageUrl: "/api/cards/images/caption-this.webp",
      attachment: { offsetX: -0.2, offsetY: 0.3, scale: 2 },
    });
    expect(wrapper.find(".card-image").attributes("style")).toContain(
      "translate(-20%, 30%) scale(2)",
    );
  });

  it("still shows the pick badge on an image prompt card", () => {
    const wrapper = mountCard({
      text: undefined,
      imageUrl: "/api/cards/images/caption-this.webp",
      numPick: 2,
    });
    expect(wrapper.find(".card-footer-pick").text()).toBe("PICK 2");
  });
});
