import type { ProfileMatch } from "~/types/profile";
import { PROFILE_MATCHES_MOCK } from "~/composables/useProfileMockData";

/**
 * Returns the player's match history.
 *
 * STUB: we don't persist match records yet — Yjs docs evaporate on lobby
 * close. A real impl should write a row to a `match_history` collection
 * when a game ends (winner, placement, opponents, prompt snapshot) and
 * expose `GET /api/me/matches?limit=20` here.
 */
export function useProfileMatches() {
  const matches = computed<ProfileMatch[]>(() => PROFILE_MATCHES_MOCK);
  return { matches };
}
