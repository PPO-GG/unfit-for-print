import { ref, computed, watch, onUnmounted } from "vue";
import type { ComputedRef, Ref } from "vue";
import type { Lobby } from "~/types/lobby";
import type { GameState } from "~/types/game";
import { useLobby } from "~/composables/useLobby";
import { useGameState } from "~/composables/useGameState";
import { useNotifications } from "~/composables/useNotifications";
import { getAppwrite } from "~/utils/appwrite";
import { useI18n } from "vue-i18n";

/**
 * Manages auto-return-to-lobby logic after a game completes.
 * Handles the 60-second countdown, gameEndTime initialization,
 * and the "Continue" action for individual players.
 */
export function useAutoReturn(options: {
  state: ComputedRef<GameState | null>;
  myId: ComputedRef<string>;
  isComplete: ComputedRef<boolean>;
  lobbyRef: Ref<Lobby | null>;
}) {
  const { state, myId, isComplete, lobbyRef } = options;
  const { markPlayerReturnedToLobby } = useLobby();
  const { encodeGameState, decodeGameState } = useGameState();
  const { notify } = useNotifications();
  const { t } = useI18n();

  const { databases } = getAppwrite();

  const autoReturnCheckInterval = ref<ReturnType<typeof setInterval> | null>(
    null,
  );

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
      if (lobbyRef.value && isComplete.value) {
        if (
          autoReturnTimeRemaining.value <= 0 &&
          !hasReturnedToLobby.value &&
          myId.value
        ) {
          await markPlayerReturnedToLobby(lobbyRef.value.$id, myId.value);
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

  // Watch for game completion to start/stop auto-return + initialize gameEndTime
  watch(isComplete, (newIsComplete) => {
    if (newIsComplete && lobbyRef.value?.status === "complete") {
      // Initialize gameEndTime in the DB if not set yet
      if (state.value && !state.value.gameEndTime) {
        if (!databases) return;
        const config = useRuntimeConfig();

        try {
          databases
            .getDocument(
              config.public.appwriteDatabaseId as string,
              config.public.appwriteLobbyCollectionId as string,
              lobbyRef.value.$id,
            )
            .then((lobbyDoc: any) => {
              const gameState = decodeGameState(lobbyDoc.gameState);
              if (!gameState.gameEndTime) {
                gameState.gameEndTime = Date.now();
                databases!
                  .updateDocument(
                    config.public.appwriteDatabaseId as string,
                    config.public.appwriteLobbyCollectionId as string,
                    lobbyRef.value!.$id,
                    { gameState: encodeGameState(gameState) },
                  )
                  .catch((err: unknown) => {
                    console.error("Failed to update gameEndTime:", err);
                  });
              }
            })
            .catch((err: unknown) => {
              console.error("Failed to get lobby document:", err);
            });
        } catch (err) {
          console.error("Failed to initialize gameEndTime:", err);
        }
      }
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
