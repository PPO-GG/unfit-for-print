import { computed } from "vue";
import {
  createSharedComposable,
  useMediaQuery,
  useWindowSize,
} from "@vueuse/core";
import { COMPACT_MEDIA_QUERY } from "~/utils/compactViewport";

/**
 * Reactive compact-layout state. Every surface that switches between the
 * desktop and phone layouts (game, lobby, game over) reads this, so the whole
 * app flips at one threshold.
 *
 * The decision comes from media queries, not from innerWidth/innerHeight:
 * media queries evaluate against the layout viewport, so an on-screen keyboard
 * or a pinch-zoom (which shrink the visual viewport and innerHeight) cannot
 * flip the layout mid-game and unmount chat. The rule itself is documented in
 * `~/utils/compactViewport` (isCompactViewport / viewportOrientation), and
 * COMPACT_MEDIA_QUERY is its CSS equivalent.
 *
 * `width`/`height` are still exposed for geometry (UserHand's fan layout).
 * Shared so every caller reuses one set of listeners.
 *
 * No SSR fallback is needed: the game page renders LobbyRoom, GameBoard and
 * GameOver inside <ClientOnly>, so the queries see the real window on the
 * first render.
 */
export const useCompactLayout = createSharedComposable(() => {
  const { width, height } = useWindowSize();
  const compactMatches = useMediaQuery(COMPACT_MEDIA_QUERY);
  const landscapeMatches = useMediaQuery("(orientation: landscape)");
  const isCompact = computed(() => compactMatches.value);
  const orientation = computed(() =>
    landscapeMatches.value ? "landscape" : "portrait",
  );
  return { isCompact, orientation, width, height };
});
