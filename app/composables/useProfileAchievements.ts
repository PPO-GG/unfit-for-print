import type { ProfileAchievement } from "~/types/profile";
import { PROFILE_ACHIEVEMENTS_MOCK } from "~/composables/useProfileMockData";

/**
 * Returns the player's achievement catalog + unlock state.
 *
 * STUB: the achievement system doesn't exist yet. When built, the real
 * implementation should surface `GET /api/me/achievements` returning the
 * same shape (catalog merged with per-player unlock rows).
 */
export function useProfileAchievements() {
  const achievements = computed<ProfileAchievement[]>(
    () => PROFILE_ACHIEVEMENTS_MOCK,
  );
  const unlockedCount = computed(
    () => achievements.value.filter((a) => a.unlocked).length,
  );
  return { achievements, unlockedCount };
}
