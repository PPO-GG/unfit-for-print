import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useCursor } from "~/composables/useCursor";

// jsdom has no matchMedia; the cursor only installs for a fine pointer.
function stubFinePointer() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: query === "(pointer: fine)" })),
  );
}

describe("useCursor", () => {
  beforeEach(stubFinePointer);

  afterEach(() => {
    document.getElementById("custom-cursor-style")?.remove();
    document.getElementById("gsap-cursor-hide")?.remove();
    document.documentElement.className = "";
    vi.unstubAllGlobals();
  });

  it("uses the CSS cursor when animation is turned off", () => {
    const cursor = useCursor({ animated: false });
    expect(cursor.animated).toBe(false);

    cursor.init();
    expect(
      document.documentElement.classList.contains("custom-cursor-active"),
    ).toBe(true);
    expect(
      document.documentElement.classList.contains("gsap-cursor-active"),
    ).toBe(false);
    cursor.destroy();
  });

  it("still honours an explicit request for the animated cursor", () => {
    expect(useCursor({ animated: true }).animated).toBe(true);
  });

  // #119: the default rule sets the arrow on every element directly, so a
  // hand on the card wrapper alone left its logo <img> showing the arrow.
  it("gives the pointer to descendants of interactive elements", () => {
    const cursor = useCursor({ animated: false });
    cursor.init();

    const css = document.getElementById("custom-cursor-style")?.textContent;
    expect(css).toContain(".custom-cursor-active .card-scaler *");
    expect(css).toContain(".custom-cursor-active .unified-card *");
    expect(css).toContain(".custom-cursor-active .cursor-pointer *");
    cursor.destroy();
  });

  it("removes its stylesheet and class on destroy", () => {
    const cursor = useCursor({ animated: false });
    cursor.init();
    cursor.destroy();

    expect(document.getElementById("custom-cursor-style")).toBeNull();
    expect(
      document.documentElement.classList.contains("custom-cursor-active"),
    ).toBe(false);
  });
});
