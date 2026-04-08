import { ref } from "vue";

/**
 * Detects whether the current device uses touch input.
 *
 * Uses three signals (any match = touch):
 * 1. `pointer: coarse` media query (real touch devices)
 * 2. `navigator.maxTouchPoints > 0` (touch-capable hardware)
 * 3. Actual `touchstart` event (fallback — catches DevTools simulation
 *    and edge cases where media queries don't update)
 */
export function useTouchDevice() {
  const isTouchDevice = ref(false);

  if (typeof window !== "undefined") {
    const coarseMatch = window.matchMedia("(pointer: coarse)");
    isTouchDevice.value = coarseMatch.matches || navigator.maxTouchPoints > 0;

    // Listen for media query changes (e.g., tablet docking/undocking keyboard)
    coarseMatch.addEventListener("change", (e) => {
      isTouchDevice.value = e.matches || navigator.maxTouchPoints > 0;
    });

    // Fallback: detect actual touch input (catches DevTools simulation)
    if (!isTouchDevice.value) {
      const onFirstTouch = () => {
        isTouchDevice.value = true;
        window.removeEventListener("touchstart", onFirstTouch);
      };
      window.addEventListener("touchstart", onFirstTouch, { once: true });
    }
  }

  return { isTouchDevice };
}
