import { ref, computed, watch } from "vue";
import type { ComputedRef, Ref } from "vue";
import type { Lobby } from "~/types/lobby";
import type { GameState } from "~/types/game";
import { useSfx } from "~/composables/useSfx";
import { SFX } from "~/config/sfx.config";

export function useWinnerSelection(options: {
  state: ComputedRef<GameState | null>;
  lobbyRef: Ref<Lobby | null>;
  roundWinner: ComputedRef<string | undefined>;
  winningCards: ComputedRef<string[]>;
}) {
  const { state, lobbyRef, roundWinner, winningCards } = options;
  const { playSfx } = useSfx();

  // Y.Doc game engine — replaces the server API call
  const lobbyDoc = useLobbyDoc();
  const engine = useYjsGameEngine(lobbyDoc);

  // Local reactive state for optimistic UI updates before real-time arrives
  const localRoundWinner = ref<string | null>("");
  const localWinningCards = ref<string[]>([]);

  /** Merges local optimistic winner with server-confirmed winner */
  const effectiveRoundWinner = computed(() => {
    return localRoundWinner.value && localRoundWinner.value !== ""
      ? localRoundWinner.value
      : roundWinner.value || null;
  });

  /** Merges local optimistic winning cards with server-confirmed cards */
  const effectiveWinningCards = computed(() => {
    if (winningCards.value && winningCards.value.length > 0) {
      return winningCards.value;
    }
    if (localWinningCards.value.length > 0) {
      return localWinningCards.value;
    }
    return [];
  });

  // Reset local round winner when the Y.Doc confirms via real-time
  watch(roundWinner, (newWinner) => {
    if (newWinner) {
      localRoundWinner.value = "";
    }
  });

  /**
   * Handles winner selection by the judge.
   * Sets optimistic local state, then mutates the Y.Doc directly.
   */
  function handleWinnerSelect(playerId: string) {
    localRoundWinner.value = playerId;

    // Pre-capture winning cards from submissions (still available at this point)
    if (
      state.value?.submissions?.[playerId] &&
      Array.isArray(state.value.submissions[playerId])
    ) {
      localWinningCards.value = state.value.submissions[playerId];
    }

    const result = engine.selectWinner(playerId);
    if (result.success) {
      playSfx(SFX.selectWinner, { pitch: [0.95, 1.05], volume: 0.75 });
    } else {
      console.error("Failed to select winner:", result.reason);
    }
  }

  return {
    effectiveRoundWinner,
    effectiveWinningCards,
    handleWinnerSelect,
  };
}
