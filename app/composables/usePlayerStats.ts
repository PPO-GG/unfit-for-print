import type { PlayerStats } from "~/types/playerStats";
import { winRatePercent } from "~/utils/winRate";

/**
 * The signed-in player's own stats for the profile page. Callers only invoke
 * fetchStats for Discord users — the route returns 403 to guests.
 */
export function usePlayerStats() {
  const { $activityFetch } = useNuxtApp();
  const stats = ref<PlayerStats | null>(null);
  const loading = ref(false);
  const error = ref(false);

  const winRate = computed(() =>
    stats.value
      ? winRatePercent(stats.value.roundsWon, stats.value.roundsPlayed)
      : null,
  );

  const isEmpty = computed(
    () =>
      !!stats.value &&
      stats.value.gamesPlayed === 0 &&
      stats.value.roundsPlayed === 0 &&
      stats.value.roundsJudged === 0,
  );

  const fetchStats = async () => {
    loading.value = true;
    error.value = false;
    try {
      stats.value = await $activityFetch<PlayerStats>("/api/stats/me");
    } catch (err) {
      console.error("Failed to fetch player stats:", err);
      error.value = true;
    } finally {
      loading.value = false;
    }
  };

  return { stats, loading, error, winRate, isEmpty, fetchStats };
}
