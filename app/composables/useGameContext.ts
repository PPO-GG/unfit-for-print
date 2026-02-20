// composables/useGameContext.ts
import { computed } from "vue";
import type { Ref } from "vue";
import type { Lobby } from "~/types/lobby";
import type { GameState, PlayerId, CardId } from "~/types/game";
import { useGameState } from "~/composables/useGameState";
import { useUserStore } from "~/stores/userStore";

const PLAYING_PHASES: GameState["phase"][] = [
  "submitting",
  "judging",
  "roundEnd",
];
const DEFAULT_COUNTDOWN_DURATION = 5;

export function useGameContext(
  lobbyRef: Ref<Lobby | null>,
  externalPlayerHands?: Ref<Record<PlayerId, CardId[]>>,
) {
  const userStore = useUserStore();
  const { decodeGameState } = useGameState();

  const state = computed<GameState | null>(() => {
    if (!lobbyRef.value) return null;
    try {
      return decodeGameState(lobbyRef.value.gameState) as GameState;
    } catch (error) {
      console.error("Failed to decode game state:", error);
      return null;
    }
  });

  const myId = computed<PlayerId>(() => {
    const id = userStore.user?.$id;
    if (!id) {
      console.warn("User ID not available");
      return "";
    }
    return id;
  });

  return {
    state,
    // UI phases
    isWaiting: computed(() => {
      // If state is null or empty object, or phase is explicitly 'waiting', consider it waiting
      return (
        state.value?.phase === "waiting" ||
        state.value === null ||
        (state.value && Object.keys(state.value).length === 0) ||
        state.value?.phase === undefined ||
        false
      );
    }),
    isSubmitting: computed(() => state.value?.phase === "submitting" || false),
    isPlaying: computed(() => {
      return (
        lobbyRef.value?.status === "playing" ||
        (state.value?.phase && PLAYING_PHASES.includes(state.value.phase)) ||
        false
      );
    }),
    isJudging: computed(() => state.value?.phase === "judging" || false),
    isComplete: computed(() => state.value?.phase === "complete" || false),
    isRoundEnd: computed(() => state.value?.phase === "roundEnd" || false),

    // Judge info
    judgeId: computed((): PlayerId | null => state.value?.judgeId ?? null),
    isJudge: computed(() => myId.value === state.value?.judgeId || false),

    // Black card prompt
    blackCard: computed(() => state.value?.blackCard ?? null),

    // Submissions map
    submissions: computed(
      (): Record<PlayerId, CardId[]> => state.value?.submissions ?? {},
    ),
    mySubmission: computed(
      (): CardId[] | null => state.value?.submissions?.[myId.value] ?? null,
    ),
    otherSubmissions: computed(() => {
      const subs = state.value?.submissions || {};
      return Object.entries(subs)
        .filter(([pid]) => pid !== myId.value)
        .map(([pid, cards]) => ({ playerId: pid as PlayerId, cards }));
    }),

    // Hands map
    hands: computed((): Record<PlayerId, CardId[]> => {
      // Use external player hands if provided, otherwise fall back to state.hands
      if (externalPlayerHands?.value) {
        return externalPlayerHands.value;
      }
      return state.value?.hands ?? {};
    }),
    myHand: computed((): CardId[] => {
      // Use external player hands if provided, otherwise fall back to state.hands
      if (externalPlayerHands?.value && myId.value) {
        return externalPlayerHands.value[myId.value] ?? [];
      }
      return state.value?.hands?.[myId.value] ?? [];
    }),

    // Scoring
    scores: computed((): Record<PlayerId, number> => state.value?.scores ?? {}),
    leaderboard: computed(() => {
      const scores = state.value?.scores ?? {};
      return Object.entries(scores)
        .map(([pid, points]) => ({
          playerId: pid as PlayerId,
          points: points,
        }))
        .sort((a, b) => b.points - a.points);
    }),

    // Winning cards (single source of truth)
    winningCards: computed((): string[] => state.value?.winningCards ?? []),

    // Round End Info
    roundWinner: computed((): PlayerId | undefined => state.value?.roundWinner),
    roundEndStartTime: computed(
      (): number | null => state.value?.roundEndStartTime ?? null,
    ),
    roundEndCountdownDuration: computed((): number => {
      if (!lobbyRef.value) return DEFAULT_COUNTDOWN_DURATION;
      return (
        lobbyRef.value.roundEndCountdownDuration ?? DEFAULT_COUNTDOWN_DURATION
      );
    }),
    myId,
  };
}
