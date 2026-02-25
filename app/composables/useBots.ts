// composables/useBots.ts
// Client-side bot orchestrator.
// Watches game state and triggers bot actions (play cards, judge) via server API.
// Only runs logic on the host's client to avoid duplicate bot actions.

import {
  ref,
  watch,
  computed,
  getCurrentInstance,
  onUnmounted,
  type Ref,
  type ComputedRef,
} from "vue";
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";
import type { GameState } from "~/types/game";
import { useGameState } from "~/composables/useGameState";

const MAX_BOTS = 5;

// Shared across all useBots instances to prevent duplicate requests
// from multiple component mounts (desktop sidebar + mobile slideover)
const addingBot = ref(false);
const botError = ref<string | null>(null);

// Shared across all useBots instances to prevent duplicate bot actions.
// Previously these were local to each useBots() call, meaning each
// component mount (page, sidebar, slideover) had its own independent
// guards — causing duplicate judge/play actions that overwrote each
// other's winner selections with different random picks.
const botActionsInFlight = new Set<string>();
let pendingBotTimers: ReturnType<typeof setTimeout>[] = [];

export function useBots(
  lobby: Ref<Lobby | null>,
  players: Ref<Player[]>,
  isHost: ComputedRef<boolean>,
) {
  const { decodeGameState } = useGameState();
  const userStore = useUserStore();

  // ─── Auth Headers ──────────────────────────────────────────────────
  // Sends session ID + user ID in headers for secure admin-SDK verification
  // server-side. Mirrors the pattern used by admin components.
  const authHeaders = () => ({
    Authorization: `Bearer ${userStore.session?.$id}`,
    "x-appwrite-user-id": userStore.user?.$id ?? "",
  });

  // ─── Derived state ────────────────────────────────────────────────────

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
      const result = await $fetch<{
        success: boolean;
        bot: {
          $id: string;
          userId: string;
          name: string;
          avatar: string;
          playerType: string;
        };
      }>("/api/bot/add", {
        method: "POST",
        headers: authHeaders(),
        body: {
          lobbyId: lobby.value.$id,
        },
      });

      // Optimistic UI update — push the new bot into the local players list
      // so the UI reflects it immediately without waiting for realtime.
      if (result?.bot && lobby.value) {
        const newBotPlayer: Player = {
          $id: result.bot.$id,
          userId: result.bot.userId,
          lobbyId: lobby.value.$id,
          name: result.bot.name,
          avatar: result.bot.avatar,
          isHost: false,
          joinedAt: new Date().toISOString(),
          provider: "bot",
          playerType: "bot",
        };
        players.value = [...players.value, newBotPlayer];
      }
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
        headers: authHeaders(),
        body: {
          lobbyId: lobby.value.$id,
          botUserId,
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
        headers: authHeaders(),
        body: {
          lobbyId: lobby.value.$id,
          botUserId,
          action,
        },
      });
    } catch (err: any) {
      console.error(`Bot ${botUserId} failed to ${action}:`, err);
    }
  };

  // ─── Automated Bot Behavior (host-only) ──────────────────────────────
  // The host's client watches game state and fires bot actions automatically.
  // botActionsInFlight & pendingBotTimers are module-level singletons
  // shared across all useBots instances to prevent duplicate actions.
  // Multiple component instances may call processBotsForPhase concurrently,
  // but the botActionsInFlight set ensures each action only fires once.

  const processBotsForPhase = async (state: GameState) => {
    if (!isHost.value || !lobby.value) return;

    const phase = state.phase;

    if (phase === "submitting") {
      // Make each bot that hasn't submitted yet play cards.
      // Bots submit SEQUENTIALLY with a stagger delay so that each
      // card fly-in animation has time to play before the next bot submits.
      // Without this, all bots fire concurrently and the client receives
      // a single coalesced state update with ALL submissions, causing
      // every card to animate simultaneously.
      const BOT_STAGGER_MS = 600; // snappy overlap — fly-in is 0.8s but ghosts are independent
      let staggerIndex = 0;

      for (const bot of botPlayers.value) {
        const actionKey = `play-${bot.userId}-${state.round}`;
        if (botActionsInFlight.has(actionKey)) continue;
        if (state.submissions?.[bot.userId]) continue; // Already submitted
        if (state.judgeId === bot.userId) continue; // Judge doesn't play

        const delay = staggerIndex * BOT_STAGGER_MS;
        staggerIndex++;

        botActionsInFlight.add(actionKey);
        const timer = setTimeout(() => {
          triggerBotAction(bot.userId, "play").finally(() => {
            botActionsInFlight.delete(actionKey);
          });
        }, delay);
        pendingBotTimers.push(timer);
      }
    } else if (phase !== "judging") {
      // Phase changed away from submitting/judging — cancel any pending bot timers
      // to prevent stale actions from a previous round/phase.
      // We must NOT clear during judging because each reveal updates gameState,
      // re-triggering this function, and we need the remaining reveal + judge timers.
      for (const t of pendingBotTimers) clearTimeout(t);
      pendingBotTimers = [];
    }

    if (phase === "judging") {
      // If the judge is a bot, reveal cards one-by-one then pick a winner.
      // This mirrors the human judge experience: flip each card, pause to
      // "think", then select a winner. Without this, the bot would skip
      // the reveal phase entirely and judge instantly.
      const judgeBot = botPlayers.value.find((b) => b.userId === state.judgeId);
      if (judgeBot) {
        const actionKey = `judge-${judgeBot.userId}-${state.round}`;
        if (botActionsInFlight.has(actionKey)) return;

        botActionsInFlight.add(actionKey);

        const REVEAL_STAGGER_MS = 1200; // time between each card reveal
        const THINKING_DELAY_MS = 2000; // pause after all reveals before picking winner
        const INITIAL_DELAY_MS = 1500; // pause before starting reveals

        // Gather submitter IDs that haven't been revealed yet, shuffled
        // so the reveal order doesn't leak who submitted first/last.
        const submitterIds = Object.keys(state.submissions || {}).filter(
          (id) => !state.revealedCards?.[id],
        );
        // Fisher-Yates shuffle
        for (let i = submitterIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [submitterIds[i], submitterIds[j]] = [
            submitterIds[j]!,
            submitterIds[i]!,
          ];
        }

        let totalDelay = INITIAL_DELAY_MS;

        // Schedule staggered reveal calls
        for (let i = 0; i < submitterIds.length; i++) {
          const playerId = submitterIds[i]!;
          const revealTimer = setTimeout(async () => {
            if (!lobby.value) return;
            try {
              await $fetch("/api/game/reveal-card", {
                method: "POST",
                headers: authHeaders(),
                body: {
                  lobbyId: lobby.value.$id,
                  playerId,
                },
              });
            } catch (err: any) {
              console.error(
                `Bot judge failed to reveal card for ${playerId}:`,
                err,
              );
            }
          }, totalDelay);
          pendingBotTimers.push(revealTimer);
          totalDelay += REVEAL_STAGGER_MS;
        }

        // After all reveals + thinking delay, pick a winner
        totalDelay += THINKING_DELAY_MS;
        const judgeTimer = setTimeout(() => {
          triggerBotAction(judgeBot.userId, "judge").finally(() => {
            botActionsInFlight.delete(actionKey);
          });
        }, totalDelay);
        pendingBotTimers.push(judgeTimer);
      }
    }

    if (phase === "complete") {
      // Game over — clean up bots
      await removeAllBots();
    }
  };

  // ─── Game State Watcher ──────────────────────────────────────────────
  // Every useBots instance registers a watcher, but botActionsInFlight
  // (a module-level singleton Set) ensures each action fires only once.
  // This is safe because action keys like `play-${botId}-${round}` are
  // unique and checked before scheduling any work.
  const stopWatcher = watch(
    gameState,
    (newState) => {
      if (!newState || !isHost.value) return;
      processBotsForPhase(newState);
    },
    { immediate: true },
  );

  // Clean up watcher when this component unmounts.
  // We do NOT clear botActionsInFlight here — other surviving instances
  // may still have pending timers referencing those keys. The timers
  // themselves clean up their own keys via .finally() callbacks.
  if (getCurrentInstance()) {
    onUnmounted(() => {
      stopWatcher();
    });
  }

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
