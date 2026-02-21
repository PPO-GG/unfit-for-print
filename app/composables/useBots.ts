// composables/useBots.ts
// Client-side bot orchestrator.
// Watches game state and triggers bot actions (play cards, judge) via server API.
// Only runs logic on the host's client to avoid duplicate bot actions.

import { ref, watch, computed, type Ref, type ComputedRef } from "vue";
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";
import type { GameState } from "~/types/game";
import { useGameState } from "~/composables/useGameState";

const MAX_BOTS = 5;

// Shared across all useBots instances to prevent duplicate requests
// from multiple component mounts (desktop sidebar + mobile slideover)
const addingBot = ref(false);
const botError = ref<string | null>(null);

export function useBots(
  lobby: Ref<Lobby | null>,
  players: Ref<Player[]>,
  isHost: ComputedRef<boolean>,
) {
  const { decodeGameState } = useGameState();
  const userStore = useUserStore();

  // ─── Derived state ────────────────────────────────────────────────────

  const hostUserId = computed(() => userStore.user?.$id || "");

  const botPlayers = computed(() =>
    players.value.filter((p) => p.playerType === "bot"),
  );

  const canAddBot = computed(() => {
    if (!isHost.value) return false;
    if (!lobby.value) return false;
    if (lobby.value.status !== "waiting") return false;
    return botPlayers.value.length < MAX_BOTS;
  });

  const gameState = computed<GameState | null>(() => {
    if (!lobby.value?.gameState) return null;
    try {
      return decodeGameState(lobby.value.gameState) as GameState;
    } catch {
      return null;
    }
  });

  // ─── Add / Remove Bot ─────────────────────────────────────────────────

  const addBot = async () => {
    if (!canAddBot.value || !lobby.value || addingBot.value) return;
    addingBot.value = true;
    botError.value = null;

    try {
      await $fetch("/api/bot/add", {
        method: "POST",
        body: {
          lobbyId: lobby.value.$id,
          hostUserId: hostUserId.value,
        },
      });
    } catch (err: any) {
      botError.value =
        err?.data?.statusMessage || err.message || "Failed to add bot";
      console.error("Failed to add bot:", err);
    } finally {
      addingBot.value = false;
    }
  };

  const removeBot = async (botUserId: string) => {
    if (!lobby.value) return;

    try {
      await $fetch("/api/bot/remove", {
        method: "POST",
        body: {
          lobbyId: lobby.value.$id,
          botUserId,
          hostUserId: hostUserId.value,
        },
      });
    } catch (err: any) {
      console.error("Failed to remove bot:", err);
    }
  };

  /**
   * Remove one bot from the lobby. Called when a real player joins
   * to make room. Removes the most recently added bot.
   */
  const removeOneBot = async () => {
    if (!lobby.value || botPlayers.value.length === 0) return;
    // Remove the last bot (most recently joined)
    const lastBot = botPlayers.value[botPlayers.value.length - 1]!;
    await removeBot(lastBot.userId);
  };

  /**
   * Remove all bots from the lobby. Called when the game ends.
   */
  const removeAllBots = async () => {
    if (!lobby.value) return;
    for (const bot of botPlayers.value) {
      try {
        await removeBot(bot.userId);
      } catch {
        // Best-effort cleanup
      }
    }
  };

  // ─── Bot Action Trigger ───────────────────────────────────────────────

  const triggerBotAction = async (
    botUserId: string,
    action: "play" | "judge",
  ) => {
    if (!lobby.value) return;
    try {
      await $fetch("/api/bot/act", {
        method: "POST",
        body: {
          lobbyId: lobby.value.$id,
          botUserId,
          action,
          hostUserId: hostUserId.value,
        },
      });
    } catch (err: any) {
      console.error(`Bot ${botUserId} failed to ${action}:`, err);
    }
  };

  // ─── Automated Bot Behavior (host-only) ──────────────────────────────
  // The host's client watches game state and fires bot actions automatically.

  const botActionsInFlight = new Set<string>();

  const processBotsForPhase = async (state: GameState) => {
    if (!isHost.value || !lobby.value) return;

    const phase = state.phase;

    if (phase === "submitting") {
      // Make each bot that hasn't submitted yet play cards
      for (const bot of botPlayers.value) {
        const actionKey = `play-${bot.userId}-${state.round}`;
        if (botActionsInFlight.has(actionKey)) continue;
        if (state.submissions?.[bot.userId]) continue; // Already submitted
        if (state.judgeId === bot.userId) continue; // Judge doesn't play

        botActionsInFlight.add(actionKey);
        triggerBotAction(bot.userId, "play").finally(() => {
          botActionsInFlight.delete(actionKey);
        });
      }
    }

    if (phase === "judging") {
      // If the judge is a bot, pick a winner
      const judgeBot = botPlayers.value.find((b) => b.userId === state.judgeId);
      if (judgeBot) {
        const actionKey = `judge-${judgeBot.userId}-${state.round}`;
        if (botActionsInFlight.has(actionKey)) return;

        botActionsInFlight.add(actionKey);
        triggerBotAction(judgeBot.userId, "judge").finally(() => {
          botActionsInFlight.delete(actionKey);
        });
      }
    }

    if (phase === "complete") {
      // Game over — clean up bots
      await removeAllBots();
    }
  };

  // Watch for game state changes and trigger bot actions
  watch(
    gameState,
    (newState) => {
      if (!newState || !isHost.value) return;
      processBotsForPhase(newState);
    },
    { immediate: true },
  );

  return {
    // State
    botPlayers,
    canAddBot,
    addingBot,
    botError,

    // Actions
    addBot,
    removeBot,
    removeOneBot,
    removeAllBots,
  };
}
