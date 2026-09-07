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

  it("shows a selection ring only when selected is true", () => {
    const selected = mount(AdminCardPreview, {
      props: { text: "x", pack: "Base", active: true, type: "white", selected: true },
    });
    expect(selected.find(".admin-card-preview").classes()).toContain("ring-2");

    const unselected = mount(AdminCardPreview, {
      props: { text: "x", pack: "Base", active: true, type: "white" },
    });
    expect(unselected.find(".admin-card-preview").classes()).not.toContain("ring-2");
  });
});

describe("AdminCardPreview.vue — picture cards", () => {
  it("renders a full-bleed image instead of text when imageUrl is set", () => {
    const wrapper = mount(AdminCardPreview, {
      props: {
        text: "",
        pack: "Memes Vol 1",
        active: true,
        type: "white",
        imageUrl: "/api/cards/images/doge.webp",
      },
    });
    expect(wrapper.find(".card-image").exists()).toBe(true);
    expect(wrapper.find(".card-image").attributes("src")).toBe("/api/cards/images/doge.webp");
    expect(wrapper.find(".card-body-text").exists()).toBe(false);
  });

  it("applies the attachment offset/scale to the image transform", () => {
    const wrapper = mount(AdminCardPreview, {
      props: {
        text: "",
        pack: "Memes Vol 1",
        active: true,
        type: "white",
        imageUrl: "/api/cards/images/doge.webp",
        attachment: { offsetX: 0.1, offsetY: -0.2, scale: 1.5 },
      },
    });
    expect(wrapper.find(".card-image").attributes("style")).toContain(
      "translate(10%, -20%) scale(1.5)",
    );
  });

  it("still renders text mode unaffected when imageUrl is absent", () => {
    const wrapper = mount(AdminCardPreview, {
      props: { text: "Text card.", pack: "Base", active: true, type: "white" },
    });
    expect(wrapper.find(".card-body-text").exists()).toBe(true);
    expect(wrapper.find(".card-image").exists()).toBe(false);
  });
});

describe("AdminCardPreview — selection affordances", () => {
  const base = { text: "A card.", pack: "Base", active: true, type: "white" as const };

  it("always renders the checkbox, not only on hover", () => {
    const wrapper = mount(AdminCardPreview, { props: base });
    expect(wrapper.find('[data-testid="card-select"]').exists()).toBe(true);
  });

  it("emits toggle-select from the checkbox without emitting click", async () => {
    const wrapper = mount(AdminCardPreview, { props: base });
    await wrapper.find('[data-testid="card-select"]').trigger("click");
    expect(wrapper.emitted("toggle-select")).toHaveLength(1);
    expect(wrapper.emitted("click")).toBeUndefined();
  });

  it("hands the originating MouseEvent to toggle-select, so shift can extend a range", async () => {
    const wrapper = mount(AdminCardPreview, { props: base });
    await wrapper
      .find('[data-testid="card-select"]')
      .trigger("click", { shiftKey: true });
    const payload = wrapper.emitted("toggle-select")?.at(-1)?.[0] as MouseEvent;
    expect(payload?.shiftKey).toBe(true);
  });

  it("emits click from the tile body", async () => {
    const wrapper = mount(AdminCardPreview, { props: base });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });

  it("marks the inspected card distinctly from a selected one", () => {
    const inspected = mount(AdminCardPreview, { props: { ...base, inspected: true } });
    expect(inspected.classes().join(" ")).toContain("inspected");
    const selected = mount(AdminCardPreview, { props: { ...base, selected: true } });
    expect(selected.classes().join(" ")).toContain("ring-2");
  });

  it("no longer exposes an actions slot", () => {
    const wrapper = mount(AdminCardPreview, {
      props: base,
      slots: { actions: '<button id="legacy">x</button>' },
    });
    expect(wrapper.find("#legacy").exists()).toBe(false);
  });

  it("paints the pack stripe when a colour is supplied", () => {
    const wrapper = mount(AdminCardPreview, {
      props: { ...base, stripeColor: "#7c3aed" },
    });
    const stripe = wrapper.find('[data-testid="card-stripe"]');
    expect(stripe.exists()).toBe(true);
    expect(stripe.attributes("style")).toContain("rgb(124, 58, 237)");
  });

  it("omits the stripe entirely when the pack has no colour", () => {
    const wrapper = mount(AdminCardPreview, { props: base });
    expect(wrapper.find('[data-testid="card-stripe"]').exists()).toBe(false);
  });
});

describe("AdminCardPreview — inactive cards", () => {
  const base = { text: "A card.", pack: "Base", type: "white" as const };

  it("dims an inactive card rather than hiding it", () => {
    const wrapper = mount(AdminCardPreview, { props: { ...base, active: false } });
    expect(wrapper.find(".admin-card-preview").classes()).toContain("opacity-40");
    expect(wrapper.find(".card-body-text").text()).toContain("A card.");
  });

  it("leaves an active card at full opacity", () => {
    const wrapper = mount(AdminCardPreview, { props: { ...base, active: true } });
    expect(wrapper.find(".admin-card-preview").classes()).not.toContain("opacity-40");
  });
});
