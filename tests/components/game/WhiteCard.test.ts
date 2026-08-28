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
