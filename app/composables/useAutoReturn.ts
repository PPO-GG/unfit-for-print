import { ref, computed, watch, onUnmounted } from "vue";
import type { ComputedRef, Ref } from "vue";
import type { Lobby } from "~/types/lobby";
import type { GameState } from "~/types/game";
import { useLobby } from "~/composables/useLobby";
import { useNotifications } from "~/composables/useNotifications";
import { useI18n } from "vue-i18n";

/**
 * Manages auto-return-to-lobby logic after a game completes.
 * Handles the 60-second countdown and the "Continue" action for individual players.
 *
 * gameEndTime is now set server-side by select-winner when phase === "complete".
 */
export function useAutoReturn(options: {
  state: ComputedRef<GameState | null>;
  myId: ComputedRef<string>;
  isComplete: ComputedRef<boolean>;
  isHost: ComputedRef<boolean>;
  lobbyRef: Ref<Lobby | null>;
}) {
  const { state, myId, isComplete, isHost, lobbyRef } = options;
  const { markPlayerReturnedToLobby, resetGameState } = useLobby();
  const { notify } = useNotifications();
  const { t } = useI18n();

  const autoReturnCheckInterval = ref<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Reactive tick counter — updated every second by the interval
  // so that computed values depending on time actually re-evaluate.
  const tickCounter = ref(0);

  /** Whether the current player has already clicked "Continue" */
  const hasReturnedToLobby = computed(() => {
    if (!state.value || !myId.value || state.value.phase !== "complete")
      return false;
    return (
      state.value.returnedToLobby && state.value.returnedToLobby[myId.value]
    );
  });

  /** Seconds remaining before the auto-return fires (60s total) */
  const autoReturnTimeRemaining = computed(() => {
    // Reference tickCounter to make this reactive on each interval tick
    void tickCounter.value;
    if (!state.value || !state.value.gameEndTime) return 60;
    const timeElapsed = Math.floor(
      (Date.now() - state.value.gameEndTime) / 1000,
    );
    return Math.max(0, 60 - timeElapsed);
  });

  /** Starts a 1-second interval that auto-returns the player when the timer expires */
  const startAutoReturnCheck = () => {
    if (autoReturnCheckInterval.value) {
      clearInterval(autoReturnCheckInterval.value);
    }

    autoReturnCheckInterval.value = setInterval(async () => {
      // Increment the tick counter to force computed recomputation
      tickCounter.value++;

      if (lobbyRef.value && isComplete.value) {
        if (
          autoReturnTimeRemaining.value <= 0 &&
          !hasReturnedToLobby.value &&
          myId.value
        ) {
          await markPlayerReturnedToLobby(lobbyRef.value.$id, myId.value);
          // Host resets the lobby so everyone transitions back to the waiting room
          if (isHost.value) {
            await resetGameState(lobbyRef.value.$id);
          }
          notify({
            title: t("lobby.return_to_lobby"),
            description: t("lobby.timer_expired_return_description"),
            color: "info",
            icon: "i-mdi-clock-check",
          });
        }
      } else if (autoReturnCheckInterval.value) {
        clearInterval(autoReturnCheckInterval.value);
      }
    }, 1000);
  };

  // Cleanup on unmount
  onUnmounted(() => {
    if (autoReturnCheckInterval.value) {
      clearInterval(autoReturnCheckInterval.value);
    }
  });

  // Watch for game completion to start/stop auto-return
  // gameEndTime is now set server-side by select-winner — no client write needed
  watch(isComplete, (newIsComplete) => {
    if (newIsComplete && lobbyRef.value?.status === "complete") {
      startAutoReturnCheck();
    } else if (autoReturnCheckInterval.value) {
      clearInterval(autoReturnCheckInterval.value);
    }
  });

  /** Player clicks "Continue" — marks them as returned to lobby */
  const handleContinue = async () => {
    if (!lobbyRef.value || !myId.value) return;

    try {
      await markPlayerReturnedToLobby(lobbyRef.value.$id, myId.value);

      // Host resets the lobby so everyone transitions back to the waiting room.
      // Non-host players will see the change via realtime subscription.
      if (isHost.value) {
        await resetGameState(lobbyRef.value.$id);
      }

      notify({
        title: t("lobby.return_to_lobby"),
        description: t("lobby.scoreboard_return_description"),
        color: "success",
        icon: "i-mdi-check-circle",
      });
    } catch (err) {
      console.error("Failed to return to lobby:", err);
      notify({
        title: t("lobby.failed_return_to_lobby"),
        color: "error",
        icon: "i-mdi-alert-circle",
      });
    }
  };

  return {
    hasReturnedToLobby,
    autoReturnTimeRemaining,
    handleContinue,
  };
}
