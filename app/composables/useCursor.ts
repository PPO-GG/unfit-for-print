import { ref } from "vue";

/**
 * Browser-adaptive custom cursor.
 *
 * Strategy selection:
 * ────────────────────
 * - **Chromium browsers**: JS-animated cursor with lerp tracking, smooth
 *   morph transitions between arrow ↔ pointer, and click-press effects.
 *   Chrome's compositor handles this at 60fps even on heavy pages.
 *
 * - **Firefox & others**: CSS `cursor: url()` for OS-level hardware
 *   rendering. Firefox's main-thread architecture causes visible jank
 *   with JS-driven cursors on heavy pages, so we let the OS handle it.
 *
 * Touch devices are excluded automatically via `(pointer: fine)`.
 */

const isChromium =
  typeof navigator !== "undefined" && /Chrome\//.test(navigator.userAgent);

/* ═══════════════════════════════════════════════════════════════
   Shared
   ═══════════════════════════════════════════════════════════════ */

const INTERACTIVE_SELECTORS = [
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
];

/* ═══════════════════════════════════════════════════════════════
   Strategy A — JS-animated cursor (Chromium only)
   ═══════════════════════════════════════════════════════════════ */

function createAnimatedCursor() {
  const cursorRef = ref<HTMLDivElement | null>(null);

  let mouseX = 0;
  let mouseY = 0;
  let currentX = 0;
  let currentY = 0;
  let rafId: number | null = null;
  let initialized = false;
  let frameCount = 0;

  let wasVisible = false;
  let wasPointer = false;
  let wasActive = false;

  const SELECTOR = INTERACTIVE_SELECTORS.join(",");

  function onMouseMove(e: MouseEvent) {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (!wasVisible && cursorRef.value) {
      currentX = mouseX;
      currentY = mouseY;
      cursorRef.value.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      cursorRef.value.classList.add("custom-cursor--visible");
      wasVisible = true;
    }
  }

  function onMouseDown() {
    if (cursorRef.value && !wasActive) {
      cursorRef.value.classList.add("custom-cursor--active");
      wasActive = true;
    }
  }

  function onMouseUp() {
    if (cursorRef.value && wasActive) {
      cursorRef.value.classList.remove("custom-cursor--active");
      wasActive = false;
    }
  }

  function onMouseLeave() {
    if (cursorRef.value && wasVisible) {
      cursorRef.value.classList.remove("custom-cursor--visible");
      wasVisible = false;
    }
  }

  function onMouseEnter() {
    if (cursorRef.value && !wasVisible) {
      currentX = mouseX;
      currentY = mouseY;
      cursorRef.value.classList.add("custom-cursor--visible");
      wasVisible = true;
    }
  }

  function animate() {
    const speed = 0.9;
    currentX += (mouseX - currentX) * speed;
    currentY += (mouseY - currentY) * speed;

    const el = cursorRef.value;
    if (el) {
      el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;

      // Throttle hit-test to every 6th frame (~10 fps at 60 fps)
      frameCount++;
      if (frameCount >= 6) {
        frameCount = 0;
        const target = document.elementFromPoint(mouseX, mouseY);
        const nowPointer = !!target?.closest(SELECTOR);

        if (nowPointer !== wasPointer) {
          el.classList.toggle("custom-cursor--pointer", nowPointer);
          wasPointer = nowPointer;
        }
      }
    }

    rafId = requestAnimationFrame(animate);
  }

  function init() {
    if (typeof window === "undefined" || initialized) return;

    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!isFinePointer) return;

    document.documentElement.classList.add("gsap-cursor-active");

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

    mouseX = window.innerWidth / 2;
    mouseY = window.innerHeight / 2;
    currentX = mouseX;
    currentY = mouseY;

    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mousedown", onMouseDown, { passive: true });
    document.addEventListener("mouseup", onMouseUp, { passive: true });
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    document.documentElement.addEventListener("mouseenter", onMouseEnter);

    rafId = requestAnimationFrame(animate);
    initialized = true;
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

    document.documentElement.classList.remove("gsap-cursor-active");
    const style = document.getElementById("gsap-cursor-hide");
    if (style) style.remove();
  }

  return { cursorRef, init, destroy, animated: true };
}

/* ═══════════════════════════════════════════════════════════════
   Strategy B — CSS OS-level cursor (Firefox & fallback)
   ═══════════════════════════════════════════════════════════════ */

function createCssCursor() {
  const cursorRef = ref<HTMLDivElement | null>(null); // unused, keeps return shape uniform
  let initialized = false;
  let styleEl: HTMLStyleElement | null = null;

  const pointerSelector = INTERACTIVE_SELECTORS.map(
    (s) => `.custom-cursor-active ${s}`,
  ).join(",\n    ");

  function init() {
    if (typeof window === "undefined" || initialized) return;

    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!isFinePointer) return;

    document.documentElement.classList.add("custom-cursor-active");

    if (!document.getElementById("custom-cursor-style")) {
      styleEl = document.createElement("style");
      styleEl.id = "custom-cursor-style";
      styleEl.textContent = `
    .custom-cursor-active,
    .custom-cursor-active * {
      cursor: url('/img/cursor/default.cur'), url('/img/cursor/default.png') 2 2, default !important;
    }
    ${pointerSelector} {
      cursor: url('/img/cursor/pointer.cur'), url('/img/cursor/pointer.png') 6 6, pointer !important;
    }
      `;
      document.head.appendChild(styleEl);
    }

    initialized = true;
  }

  function destroy() {
    initialized = false;
    document.documentElement.classList.remove("custom-cursor-active");
    if (styleEl) {
      styleEl.remove();
      styleEl = null;
    } else {
      const existing = document.getElementById("custom-cursor-style");
      if (existing) existing.remove();
    }
  }

  return { cursorRef, init, destroy, animated: false };
}

/* ═══════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════ */

export function useCursor() {
  return isChromium ? createAnimatedCursor() : createCssCursor();
}
