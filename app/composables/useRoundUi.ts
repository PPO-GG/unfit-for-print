import { computed, ref, watch, type Ref } from "vue";
import { isNewPrompt } from "~/utils/roundBoundary";

export interface RoundUiSource {
  phase: Ref<string>;
  promptSerial: Ref<number | undefined>;
  pick: Ref<number>;
  isHost: Ref<boolean>;
  submissions: Ref<Record<string, string[]>>;
  revealedCards: Ref<Record<string, boolean>>;
  /** Changes every round/prompt, so the judging order does too. */
  seed: Ref<string>;
}

/** 32-bit FNV-1a, unsigned. */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
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

  // Every client shows the same order, but it is reshuffled by the seed each
  // round — sorting by player id would park each player's card in the same slot
  // every round and tell the judge whose it is.
  const submissionIds = computed(() => {
    const seed = src.seed.value;
    return Object.keys(src.submissions.value)
      .map((pid) => ({ pid, h: fnv1a(`${pid}|${seed}`) }))
      .sort((a, b) => a.h - b.h || (a.pid < b.pid ? -1 : a.pid > b.pid ? 1 : 0))
      .map((e) => e.pid);
  });
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
