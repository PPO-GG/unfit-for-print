import type { LabsStats, LabsSubmission } from "~/types/labs";
import { LABS_STATS_MOCK } from "~/composables/useLabsMockData";

/**
 * Labs stats — mixed real + stub.
 *
 * Real: totalSubmissions + votesCast are derived from the live
 * submissions stream.
 *
 * Stub: inPlaytest / graduated / contributors / thisWeek — those
 * counters need a real moderation pipeline + contributor tracking.
 * See docs/ui-overhaul-future-features.md → Labs for the wiring plan.
 */
export function useLabsStats(submissions: Ref<LabsSubmission[]>) {
  const stats = computed<LabsStats>(() => {
    const total = submissions.value.length;
    const votes = submissions.value.reduce((sum, s) => sum + s.up, 0);
    return {
      ...LABS_STATS_MOCK,
      totalSubmissions: total || LABS_STATS_MOCK.totalSubmissions,
      votesCast: votes || LABS_STATS_MOCK.votesCast,
    };
  });
  return { stats };
}
