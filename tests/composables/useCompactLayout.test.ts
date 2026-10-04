import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { useCompactLayout } from "~/composables/useCompactLayout";

function resizeTo(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
  window.dispatchEvent(new Event("resize"));
}

describe("useCompactLayout", () => {
  it("tracks the window across a rotation", async () => {
    resizeTo(375, 812);
    const { isCompact, orientation } = useCompactLayout();
    expect(isCompact.value).toBe(true);
    expect(orientation.value).toBe("portrait");

    resizeTo(844, 390);
    await nextTick();
    expect(isCompact.value).toBe(true);
    expect(orientation.value).toBe("landscape");

    resizeTo(1280, 800);
    await nextTick();
    expect(isCompact.value).toBe(false);
  });
});
