import { ref, onMounted } from "vue";

/**
 * Detects whether the current device uses coarse pointer (touch).
 * Distinguishes tablet touch from desktop mouse at the same viewport width.
 */
export function useTouchDevice() {
  const isTouchDevice = ref(false);

  if (typeof window !== "undefined") {
    // Check both media query and touch points for robust detection
    const coarseMatch = window.matchMedia("(pointer: coarse)");
    isTouchDevice.value = coarseMatch.matches || navigator.maxTouchPoints > 0;

    // Listen for changes (e.g., tablet docking/undocking keyboard)
    coarseMatch.addEventListener("change", (e) => {
      isTouchDevice.value = e.matches || navigator.maxTouchPoints > 0;
    });
  }

  return { isTouchDevice };
}
