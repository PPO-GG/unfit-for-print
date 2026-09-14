// tests/components/labs/CardLightbox.test.ts
//
// While the browser fetches the page holding the next position, the lightbox
// keeps the card it last showed on stage, dimmed under a spinner, instead of
// collapsing to an empty placeholder.
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import * as Vue from "vue";
import type { BrowsableCard } from "~/types/cardBrowser";

Object.assign(globalThis, Vue);
vi.unmock("vue");

vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));

import CardLightbox from "~/components/labs/CardLightbox.vue";

const CARD: BrowsableCard = {
  id: "w24",
  text: "Card 25",
  pack: "Base",
  packId: "p1",
  packSeries: null,
  imageKey: null,
  imageFormat: null,
  attachment: null,
};

function mountLightbox(props: Record<string, unknown>) {
  return mount(CardLightbox, {
    props: { open: true, type: "white", position: 25, total: 30, ...props },
    global: {
      stubs: {
        UModal: { template: "<div><slot name='body' /></div>" },
        WhiteCard: { props: ["cardId"], template: "<div class='white-card' />" },
        BlackCard: true,
        Icon: true,
      },
    },
  });
}

describe("CardLightbox — pending state", () => {
  it("keeps a pending card on stage, dimmed, with a spinner overlay", () => {
    const wrapper = mountLightbox({ card: CARD, pending: true });
    expect(wrapper.find(".white-card").exists()).toBe(true);
    expect(wrapper.find(".lightbox__card--pending").exists()).toBe(true);
    expect(wrapper.find(".lightbox__spinner").exists()).toBe(true);
    expect(wrapper.find(".lightbox__pending").exists()).toBe(false);
  });

  it("shows no overlay once the card has resolved", () => {
    const wrapper = mountLightbox({ card: CARD, pending: false });
    expect(wrapper.find(".lightbox__card--pending").exists()).toBe(false);
    expect(wrapper.find(".lightbox__spinner").exists()).toBe(false);
  });

  it("falls back to the placeholder when there is no card to keep", () => {
    const wrapper = mountLightbox({ card: null, pending: true });
    expect(wrapper.find(".lightbox__pending").exists()).toBe(true);
  });
});
