import { ref } from "vue";

/**
 * GSAP-powered custom cursor with smooth lerp tracking.
 *
 * Hides the native cursor via `cursor: none`, renders two image layers
 * (default arrow + pointer hand) and switches between them
 * based on what the mouse is hovering.
 *
 * Uses direct `style.transform` on the live Vue ref each frame,
 * avoiding stale DOM references from quickSetter.
 *
 * - Interactive elements (buttons, links, cards) trigger a pointer morph.
 * - Touch devices are excluded automatically.
 */
export function useCursor() {
  const cursorEl = ref<HTMLDivElement | null>(null);
  const isVisible = ref(false);
  const isPointer = ref(false);
  const isActive = ref(false); // mouse pressed

  let mouseX = 0;
  let mouseY = 0;
  let currentX = 0;
  let currentY = 0;
  let rafId: number | null = null;
  let initialized = false;

  // CSS selectors that trigger the pointer cursor morph
  const INTERACTIVE_SELECTOR = [
    "a",
    "button",
    '[role="button"]',
    "input",
    "select",
    "textarea",
    "label[for]",
    ".cursor-pointer",
    ".card-scaler",
    ".unified-card",
    ".grid-cell--clickable",
    ".grid-cell--selectable",
    ".submission-group--clickable",
    ".submission-group--selectable",
  ].join(",");

  function isElementInteractive(el: Element | null): boolean {
    if (!el) return false;
    return !!el.closest(INTERACTIVE_SELECTOR);
  }

  function onMouseMove(e: MouseEvent) {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (!isVisible.value) {
      isVisible.value = true;
    }

    // Check what we're hovering
    const target = document.elementFromPoint(e.clientX, e.clientY);
    isPointer.value = isElementInteractive(target);
  }

  function onMouseDown() {
    isActive.value = true;
  }

  function onMouseUp() {
    isActive.value = false;
  }

  function onMouseLeave() {
    isVisible.value = false;
  }

  function onMouseEnter() {
    isVisible.value = true;
  }

  /**
   * Animation loop using lerp for smooth cursor trailing.
   * Directly sets style.transform on the current cursorEl ref each frame,
   * so the cursor always tracks the live DOM element even if Vue re-renders it.
   */
  function animate() {
    const speed = 0.2; // lerp factor (lower = smoother/laggier)
    currentX += (mouseX - currentX) * speed;
    currentY += (mouseY - currentY) * speed;

    const el = cursorEl.value;
    if (el) {
      el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }

    rafId = requestAnimationFrame(animate);
  }

  function init() {
    if (typeof window === "undefined") return;
    if (initialized) return;

    // Many Windows laptops have touchscreens but are primarily used with a mouse.
    // maxTouchPoints > 0 will block the cursor for those users.
    // Instead we rely partially on matchMedia but allow normal pointer functionality.
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!isFinePointer) {
      console.log(
        "[GSAP Cursor] Bailing: No fine pointer device detected (likely mobile).",
      );
      return;
    }

    // Add class to <html> to disable CSS cursor rules and hide native cursor
    document.documentElement.classList.add("gsap-cursor-active");

    // Inject cursor:none so the native cursor is hidden
    if (!document.getElementById("gsap-cursor-hide")) {
      const style = document.createElement("style");
      style.id = "gsap-cursor-hide";
      style.textContent = `
        .gsap-cursor-active, .gsap-cursor-active *, .gsap-cursor-active *::before, .gsap-cursor-active *::after {
          cursor: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Position at center initially
    mouseX = window.innerWidth / 2;
    mouseY = window.innerHeight / 2;
    currentX = mouseX;
    currentY = mouseY;

    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mousedown", onMouseDown, { passive: true });
    document.addEventListener("mouseup", onMouseUp, { passive: true });
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    document.documentElement.addEventListener("mouseenter", onMouseEnter);

    // Start the animation loop immediately — it checks cursorEl.value each frame
    rafId = requestAnimationFrame(animate);
    initialized = true;
    console.log("[GSAP Cursor] Active — smooth cursor enabled");
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    initialized = false;

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mouseup", onMouseUp);
    document.documentElement.removeEventListener("mouseleave", onMouseLeave);
    document.documentElement.removeEventListener("mouseenter", onMouseEnter);

    // Remove class and injected style
    document.documentElement.classList.remove("gsap-cursor-active");
    const style = document.getElementById("gsap-cursor-hide");
    if (style) style.remove();
  }

  return {
    cursorEl,
    isVisible,
    isPointer,
    isActive,
    init,
    destroy,
  };
}
