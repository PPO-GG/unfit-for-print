import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

// @ts-ignore — provided by @nuxtjs/i18n's auto-import at runtime
globalThis.useI18n = () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
});

import StarRating from "~/components/StarRating.vue";

function mountStars(modelValue: number | null = null) {
  return mount(StarRating, { props: { modelValue, label: "Rate us" }, attachTo: document.body });
}

describe("StarRating", () => {
  it("renders five radios in a labelled group", () => {
    const w = mountStars();
    expect(w.get('[role="radiogroup"]').attributes("aria-label")).toBe("Rate us");
    expect(w.findAll('[role="radio"]')).toHaveLength(5);
  });

  it("emits the clicked star", async () => {
    const w = mountStars();
    await w.get('[data-testid="star-4"]').trigger("click");
    expect(w.emitted("update:modelValue")).toEqual([[4]]);
  });

  it("marks only the selected star as checked", () => {
    const w = mountStars(3);
    expect(w.get('[data-testid="star-3"]').attributes("aria-checked")).toBe("true");
    expect(w.get('[data-testid="star-2"]').attributes("aria-checked")).toBe("false");
  });

  const tabbableStar = (w: ReturnType<typeof mountStars>) =>
    w.findAll('[role="radio"]').filter((b) => b.attributes("tabindex") === "0")
      .map((b) => b.attributes("data-testid"));
  const isOn = (w: ReturnType<typeof mountStars>, n: number) =>
    w.get(`[data-testid="star-${n}"]`).classes().includes("is-on");

  it("moves focus and the tab stop with arrow keys without choosing", async () => {
    const w = mountStars(null);
    const star1 = w.get('[data-testid="star-1"]');
    (star1.element as HTMLElement).focus();
    await star1.trigger("keydown", { key: "ArrowRight" });
    expect(document.activeElement).toBe(w.get('[data-testid="star-2"]').element);
    expect(tabbableStar(w)).toEqual(["star-2"]);
    // The highlight previews the focused star.
    expect(isOn(w, 2)).toBe(true);
    expect(isOn(w, 3)).toBe(false);
    await w.get('[data-testid="star-2"]').trigger("keydown", { key: "ArrowLeft" });
    expect(document.activeElement).toBe(star1.element);
    expect(w.emitted("update:modelValue")).toBeUndefined();
    w.unmount();
  });

  it("clamps arrow movement to 1–5", async () => {
    const w = mountStars(5);
    const star5 = w.get('[data-testid="star-5"]');
    (star5.element as HTMLElement).focus();
    await star5.trigger("keydown", { key: "ArrowRight" });
    expect(document.activeElement).toBe(star5.element);
    expect(w.emitted("update:modelValue")).toBeUndefined();
    w.unmount();
  });

  it("jumps to the first and last star with Home and End", async () => {
    const w = mountStars(3);
    const star3 = w.get('[data-testid="star-3"]');
    (star3.element as HTMLElement).focus();
    await star3.trigger("keydown", { key: "End" });
    expect(document.activeElement).toBe(w.get('[data-testid="star-5"]').element);
    await w.get('[data-testid="star-5"]').trigger("keydown", { key: "Home" });
    expect(document.activeElement).toBe(w.get('[data-testid="star-1"]').element);
    expect(tabbableStar(w)).toEqual(["star-1"]);
    expect(w.emitted("update:modelValue")).toBeUndefined();
    w.unmount();
  });

  // Native <button>s turn Enter and Space into a click, which is the only
  // commit path — the keys themselves must not commit (or commit twice).
  it("commits the focused star through its native button click (Enter/Space)", async () => {
    const w = mountStars(null);
    const star1 = w.get('[data-testid="star-1"]');
    (star1.element as HTMLElement).focus();
    await star1.trigger("keydown", { key: "ArrowRight" });
    const star3 = w.get('[data-testid="star-3"]');
    await w.get('[data-testid="star-2"]').trigger("keydown", { key: "ArrowRight" });
    expect(document.activeElement).toBe(star3.element);
    for (const key of ["Enter", " "]) {
      await star3.trigger("keydown", { key });
    }
    expect(w.emitted("update:modelValue")).toBeUndefined();
    expect(star3.element.tagName).toBe("BUTTON");
    expect(star3.attributes("type")).toBe("button");
    await star3.trigger("click");
    expect(w.emitted("update:modelValue")).toEqual([[3]]);
    w.unmount();
  });

  it("returns the tab stop to the checked star when focus leaves", async () => {
    const w = mountStars(4);
    const star4 = w.get('[data-testid="star-4"]');
    (star4.element as HTMLElement).focus();
    await star4.trigger("keydown", { key: "ArrowLeft" });
    expect(tabbableStar(w)).toEqual(["star-3"]);
    (document.activeElement as HTMLElement).blur();
    await w.vm.$nextTick();
    expect(tabbableStar(w)).toEqual(["star-4"]);
    w.unmount();
  });

  it("drops a hover highlight once a star is chosen", async () => {
    const w = mountStars(null);
    await w.get('[data-testid="star-5"]').trigger("mouseenter");
    expect(isOn(w, 5)).toBe(true);
    await w.get('[data-testid="star-5"]').trigger("click");
    await w.setProps({ modelValue: 2 });
    expect(isOn(w, 2)).toBe(true);
    expect(isOn(w, 3)).toBe(false);
  });

  it("keeps one star in the tab order", () => {
    const w = mountStars(null);
    expect(tabbableStar(w)).toEqual(["star-1"]);
  });
});
