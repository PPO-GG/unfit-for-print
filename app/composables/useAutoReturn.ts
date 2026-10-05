import { ref, computed, watch, onScopeDispose } from "vue";
import type { ComputedRef, Ref } from "vue";
import type { Lobby } from "~/types/lobby";
import type { GameState } from "~/types/game";
import type { LobbyDocResult } from "~/composables/useLobbyDoc";
import { useYjsGameEngine } from "~/composables/useYjsGameEngine";

/** The winning card's highlight and celebration play before the podium. */
export const CELEBRATION_MS = 7000;
/** How long the podium stays up before everyone goes back to the lobby. */
export const PODIUM_SECONDS = 10;
/** A guest steps in if the host hasn't reset this long after the podium ends. */
const HOST_GRACE_MS = 3000;

/**
 * The end of a game: after the celebration, the podium shows for
 * PODIUM_SECONDS, then the host resets the game and every client lands back in
 * the lobby, where the host can change settings and start again.
 *
 * Timed from the doc's shared `gameEndTime`, so every client counts down to
 * the same moment. If the host's client is gone (tab closed, phone asleep), a
 * guest resets after a short grace period instead of leaving everyone on the
 * podium. A reset is idempotent, so two clients doing it is harmless.
 */
export function useAutoReturn(options: {
  state: ComputedRef<GameState | null>;
  myId: ComputedRef<string>;
  isComplete: ComputedRef<boolean>;
  isHost: ComputedRef<boolean>;
  lobbyRef: Ref<Lobby | null>;
  lobbyDoc: LobbyDocResult;
  /** Resets the game back to the waiting room (useLobby().resetGameState). */
  resetGame: () => unknown;
}) {
  const { state, myId, isComplete, isHost, lobbyRef, lobbyDoc, resetGame } = options;
  const engine = useYjsGameEngine(lobbyDoc);

  // Bumped every second so the countdown re-evaluates against the clock.
  const now = ref(Date.now());
  let ticker: ReturnType<typeof setInterval> | null = null;
  let resetSent = false;

  /** This player went ahead to the lobby before the podium time was up. */
  const hasReturnedToLobby = computed(() => {
    if (!state.value || !myId.value || state.value.phase !== "complete") return false;
    return !!state.value.returnedToLobby?.[myId.value];
  });

  /** When the podium ends, from the doc's shared game-end time. */
  const podiumEndsAt = computed(() => {
    const end = state.value?.gameEndTime;
    return end ? end + CELEBRATION_MS + PODIUM_SECONDS * 1000 : null;
  });

  /** Seconds the podium has left: PODIUM_SECONDS until it appears, then down to 0. */
  const podiumSecondsLeft = computed(() => {
    if (podiumEndsAt.value === null) return PODIUM_SECONDS;
    const left = Math.ceil((podiumEndsAt.value - now.value) / 1000);
    return Math.min(PODIUM_SECONDS, Math.max(0, left));
  });

  function resetOnce() {
    if (resetSent) return;
    resetSent = true;
    resetGame();
  }

  function tick() {
    now.value = Date.now();
    if (!isComplete.value || !lobbyRef.value || podiumEndsAt.value === null) return;
    const overdue = now.value - podiumEndsAt.value;
    if (overdue < 0) return;
    if (isHost.value || overdue >= HOST_GRACE_MS) resetOnce();
  }

  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }

  watch(
    isComplete,
    (complete) => {
      stopTicker();
      resetSent = false;
      if (complete) {
        now.value = Date.now();
        ticker = setInterval(tick, 1000);
      }
    },
    { immediate: true },
  );
  onScopeDispose(stopTicker);

  /**
   * "Back to lobby": the host brings everyone now; a guest goes ahead on their
   * own and waits there for the others.
   */
  const handleContinue = async () => {
    if (!lobbyRef.value || !myId.value) return;
    if (isHost.value) resetOnce();
    else engine.markReturnedToLobby(myId.value);
  };

  return {
    hasReturnedToLobby,
    podiumSecondsLeft,
    handleContinue,
  };
}
