// tests/components/AdminCardPreview.test.ts
//
// Covers the Showbill V4 redesign of the Cards Manager grid tile: it now
// mirrors BlackCard.vue/WhiteCard.vue's spine + footer layout instead of the
// old centered-text card, and reuses useFitText for the body text.
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
vi.unmock("vue");

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);

import AdminCardPreview from "~/components/admin/AdminCardPreview.vue";

describe("AdminCardPreview.vue — Showbill V4 layout", () => {
  it("renders the pack name in the footer and the card text in the body", () => {
    const wrapper = mount(AdminCardPreview, {
      props: {
        text: "A funny white card.",
        pack: "CAH Base Set",
        active: true,
        type: "white",
      },
    });

    expect(wrapper.find(".card-footer-pack").text()).toBe("CAH Base Set");
    expect(wrapper.find(".card-body-text").text()).toContain("A funny white card.");
    expect(wrapper.find(".card-spine-label").exists()).toBe(true);
  });

  it("shows the pick badge for a black card with pick > 1, not for pick 1", () => {
    const multiPick = mount(AdminCardPreview, {
      props: { text: "_ + _ = chaos.", pack: "Base", active: true, type: "black", pick: 2 },
    });
    expect(multiPick.find(".card-footer-pick").exists()).toBe(true);
    expect(multiPick.find(".card-footer-pick").text()).toBe("PICK 2");

    const singlePick = mount(AdminCardPreview, {
      props: { text: "A single-pick prompt.", pack: "Base", active: true, type: "black", pick: 1 },
    });
    expect(singlePick.find(".card-footer-pick").exists()).toBe(false);
  });

  it("replaces underscores with a blank-fill span for black cards only", () => {
    const black = mount(AdminCardPreview, {
      props: { text: "_ is the answer.", pack: "Base", active: true, type: "black" },
    });
    expect(black.find(".card-body-text").html()).toContain("display:inline-block");

    const white = mount(AdminCardPreview, {
      props: { text: "_ is not replaced.", pack: "Base", active: true, type: "white" },
    });
    expect(white.find(".card-body-text").text()).toBe("_ is not replaced.");
  });

  it("shows an active-status dot that reflects the active prop", () => {
    const active = mount(AdminCardPreview, {
      props: { text: "x", pack: "Base", active: true, type: "white" },
    });
    expect(active.find(".bg-green-400").exists()).toBe(true);

    const inactive = mount(AdminCardPreview, {
      props: { text: "x", pack: "Base", active: false, type: "white" },
    });
    expect(inactive.find(".bg-red-500\\/60").exists()).toBe(true);
  });

  it("emits click when the card is clicked", async () => {
    const wrapper = mount(AdminCardPreview, {
      props: { text: "x", pack: "Base", active: true, type: "white" },
    });
    await wrapper.find(".admin-card-preview").trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });
});
