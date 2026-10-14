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

  it("moves the selection with arrow keys, clamped to 1–5", async () => {
    const w = mountStars(5);
    await w.get('[data-testid="star-5"]').trigger("keydown", { key: "ArrowRight" });
    await w.get('[data-testid="star-5"]').trigger("keydown", { key: "ArrowLeft" });
    expect(w.emitted("update:modelValue")).toEqual([[5], [4]]);
  });

  it("keeps one star in the tab order", () => {
    const w = mountStars(null);
    const tabbable = w.findAll('[role="radio"]').filter((b) => b.attributes("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
  });
});
