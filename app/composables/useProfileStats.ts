import type { ProfileStats } from "~/types/profile";
import { PROFILE_STATS_MOCK } from "~/composables/useProfileMockData";

/**
 * Returns player stats.
 *
 * STUB: currently returns a static mock. Real implementation should hit
 * `GET /api/me/stats` backed by the (not-yet-built) metrics rollup
 * pipeline — see `docs/ui-overhaul-future-features.md` → "Statistics /
 * KPIs pipeline".
 */
export function useProfileStats() {
  const stats = computed<ProfileStats>(() => PROFILE_STATS_MOCK);
  return { stats };
}
