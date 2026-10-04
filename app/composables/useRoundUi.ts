import { computed, ref, watch, type Ref } from "vue";
import { isNewPrompt } from "~/utils/roundBoundary";

export interface RoundUiSource {
  phase: Ref<string>;
  promptSerial: Ref<number | undefined>;
  pick: Ref<number>;
  isHost: Ref<boolean>;
  submissions: Ref<Record<string, string[]>>;
  revealedCards: Ref<Record<string, boolean>>;
}

/**
 * Per-client round UI state that the doc does not hold: which cards this
 * player has tapped, and which revealed submission the judge is about to
 * crown. Lives in a composable (not a component) so a rotation that re-lays
 * out the compact view keeps it.
 */
export function useRoundUi(src: RoundUiSource) {
  const selected = ref<string[]>([]);
  const pendingWinner = ref<string | null>(null);

  function reset() {
    selected.value = [];
    pendingWinner.value = null;
  }
  watch(src.phase, reset);
  // A skip swaps the prompt without a phase change.
  watch(src.promptSerial, (next, prev) => {
    if (isNewPrompt(next, prev)) reset();
  });

  function toggleCard(cardId: string) {
    if (selected.value.includes(cardId)) {
      selected.value = selected.value.filter((id) => id !== cardId);
    } else if (selected.value.length < src.pick.value) {
      selected.value = [...selected.value, cardId];
    }
  }
  function clearSelection() {
    selected.value = [];
  }
  const remainingPicks = computed(() =>
    Math.max(0, src.pick.value - selected.value.length),
  );
  const canSubmit = computed(
    () => src.pick.value > 0 && selected.value.length === src.pick.value,
  );

  // Sorted so every client shows submissions in the same, player-agnostic order.
  const submissionIds = computed(() =>
    Object.keys(src.submissions.value).sort(),
  );
  const revealedCount = computed(
    () => submissionIds.value.filter((id) => src.revealedCards.value[id]).length,
  );
  const allRevealed = computed(
    () =>
      submissionIds.value.length > 0 &&
      revealedCount.value === submissionIds.value.length,
  );

  function choosePendingWinner(playerId: string) {
    if (!allRevealed.value || !submissionIds.value.includes(playerId)) return;
    pendingWinner.value = pendingWinner.value === playerId ? null : playerId;
  }
  watch(submissionIds, (ids) => {
    if (pendingWinner.value && !ids.includes(pendingWinner.value)) {
      pendingWinner.value = null;
    }
  });

  const canAdvance = computed(
    () => src.isHost.value && src.phase.value === "roundEnd",
  );

  return {
    selected,
    toggleCard,
    clearSelection,
    remainingPicks,
    canSubmit,
    submissionIds,
    revealedCount,
    allRevealed,
    pendingWinner,
    choosePendingWinner,
    canAdvance,
  };
}
