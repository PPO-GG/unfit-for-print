/**
 * Client-side user preferences for card play modes.
 *
 * Persists to localStorage so the setting sticks across sessions.
 * Three modes:
 *   - 'click'   → current default: click cards, 1.2 s auto-submit timer
 *   - 'instant' → submit immediately when all required cards are selected
 *   - 'gesture' → select cards by tapping, then drag / flick to submit
 */
import { computed } from "vue";
import { useLocalStorage } from "@vueuse/core";

export type CardPlayMode = "click" | "instant" | "gesture";

const STORAGE_KEY = "unfit-card-play-mode";

export function useCardPlayPreferences() {
  const playMode = useLocalStorage<CardPlayMode>(STORAGE_KEY, "click");

  const instantSubmit = computed(() => playMode.value === "instant");
  const gestureEnabled = computed(() => playMode.value === "gesture");

  function cycleMode() {
    const order: CardPlayMode[] = ["click", "instant", "gesture"];
    const idx = order.indexOf(playMode.value);
    playMode.value = order[(idx + 1) % order.length];
  }

  return {
    playMode,
    instantSubmit,
    gestureEnabled,
    cycleMode,
  };
}
