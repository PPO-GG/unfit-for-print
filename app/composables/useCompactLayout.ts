import { computed } from "vue";
import { useWindowSize } from "@vueuse/core";
import {
  isCompactViewport,
  viewportOrientation,
} from "~/utils/compactViewport";

/**
 * Reactive compact-layout state. Every surface that switches between the
 * desktop and phone layouts (game, lobby, game over) reads this, so the whole
 * app flips at one threshold.
 *
 * No SSR fallback is needed: the game page renders LobbyRoom, GameBoard and
 * GameOver inside <ClientOnly>, so useWindowSize sees the real window on the
 * first render.
 */
export function useCompactLayout() {
  const { width, height } = useWindowSize();
  const isCompact = computed(() => isCompactViewport(width.value, height.value));
  const orientation = computed(() =>
    viewportOrientation(width.value, height.value),
  );
  return { isCompact, orientation, width, height };
}
