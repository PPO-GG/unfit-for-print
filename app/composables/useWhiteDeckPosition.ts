/**
 * Shared composable for tracking the white card deck's screen position.
 *
 * WhiteCardDeck registers its element on mount.
 * UserHand reads the deck position to animate new cards as if
 * they were dealt from the deck.
 */
import { ref, readonly } from "vue";

// Module-level state — shared across all component instances
const deckElement = ref<HTMLElement | null>(null);
const isDealing = ref(false);
let dealTimeout: ReturnType<typeof setTimeout> | null = null;

export function useWhiteDeckPosition() {
  /** Called by WhiteCardDeck on mount to register its root element. */
  function registerDeck(el: HTMLElement | null) {
    deckElement.value = el;
  }

  /** Returns the center of the deck in viewport coordinates, or null. */
  function getDeckCenter(): { x: number; y: number } | null {
    // Try stored element first
    let el = deckElement.value;
    if (el && el.getBoundingClientRect().width > 0) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    // Fallback: query DOM by data attribute
    const fallback = document.querySelector<HTMLElement>("[data-deck='white']");
    if (fallback) {
      deckElement.value = fallback; // cache for next time
      const r = fallback.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return null;
  }

  /** Triggers a brief "dealing" visual state on the deck. */
  function triggerDeal(durationMs = 800) {
    if (dealTimeout) clearTimeout(dealTimeout);
    isDealing.value = true;
    dealTimeout = setTimeout(() => {
      isDealing.value = false;
    }, durationMs);
  }

  return {
    registerDeck,
    getDeckCenter,
    triggerDeal,
    isDealing: readonly(isDealing),
  };
}
