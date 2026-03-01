// composables/useBots.ts
// Client-side bot orchestrator.
// Watches game state and triggers bot actions (play cards, judge) via Y.Doc engine.
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
  const userStore = useUserStore();

  // ─── Y.Doc Integration ──────────────────────────────────────────────
  // Bots are written to Y.Doc (the source of truth for real-time state)
  // in addition to Appwrite (for server-side auth/validation).
  const lobbyDoc = useLobbyDoc();
  const mutations = useLobbyMutations(lobbyDoc);

  // Y.Doc game engine — used for bot play/reveal/judge actions
  const engine = useYjsGameEngine(lobbyDoc);

  // Y.Doc reactive state — used to watch game state changes
  const reactive = useLobbyReactive(lobbyDoc);

  // ─── Auth Headers ──────────────────────────────────────────────────
  // Sends session ID + user ID in headers for secure admin-SDK verification
  // server-side. Only used for add/remove bot Appwrite shim calls.
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

  // Read game state from Y.Doc reactive bridge (not Appwrite).
  const gameState = computed<GameState | null>(
    () => reactive.gameState.value ?? null,
  );

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

      // Write the bot into Y.Doc — this triggers reactive updates across
      // all connected clients via useLobbyReactive's observer.
      if (result?.bot && lobbyDoc.doc.value) {
        mutations.addPlayer({
          userId: result.bot.userId,
          name: result.bot.name,
          avatar: result.bot.avatar,
          isHost: false,
          joinedAt: new Date().toISOString(),
          provider: "bot",
          playerType: "bot",
        });
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

    // Get bot name before removing (for system message in Y.Doc)
    let botName: string | undefined;
    if (lobbyDoc.doc.value) {
      try {
        const raw = lobbyDoc.getPlayers().get(botUserId);
        if (raw) botName = JSON.parse(raw).name;
      } catch {
        /* ignore */
      }
    }

    try {
      await $fetch("/api/bot/remove", {
        method: "POST",
        headers: authHeaders(),
        body: {
          lobbyId: lobby.value.$id,
          botUserId,
        },
      });

      // Remove from Y.Doc — triggers reactive updates across all clients
      if (lobbyDoc.doc.value) {
        mutations.removePlayer(botUserId, botName);
      }
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

  // ─── Bot Card Play (via Y.Doc engine) ──────────────────────────────────

  /**
   * Picks random cards from a bot's hand and plays them via the Y.Doc engine.
   * Returns true if the action succeeded.
   */
  const botPlayCards = (botUserId: string): boolean => {
    const state = gameState.value;
    if (!state || state.phase !== "submitting") return false;
    if (state.judgeId === botUserId) return false;
    if (state.submissions?.[botUserId]) return false;

    // Read the bot's hand from Y.Doc
    const hand = engine.readHand(botUserId);
    if (!hand || hand.length === 0) {
      console.warn(`[useBots] Bot ${botUserId} has no cards in hand`);
      return false;
    }

    // Determine how many cards to play (based on black card pick count)
    const pickCount = state.blackCard?.pick || 1;
    const cardsToPlay = hand.slice(0, Math.min(pickCount, hand.length));

    const result = engine.playCard(cardsToPlay, botUserId);
    if (!result.success) {
      console.warn(`[useBots] Bot ${botUserId} play failed:`, result.reason);
    }
    return result.success;
  };

  // ─── Bot Reveal & Judge (via Y.Doc engine) ─────────────────────────────

  /**
   * Bot judge reveals a single card. Returns true if successful.
   */
  const botRevealCard = (playerId: string): boolean => {
    const result = engine.revealCard(playerId);
    return result.success;
  };

  /**
   * Bot judge picks a random winner from submissions.
   * Returns true if successful.
   */
  const botSelectWinner = (): boolean => {
    const state = gameState.value;
    if (!state || state.phase !== "judging") return false;

    const submitterIds = Object.keys(state.submissions || {});
    if (submitterIds.length === 0) return false;

    const randomIndex = Math.floor(Math.random() * submitterIds.length);
    const winnerId = submitterIds[randomIndex]!;

    const result = engine.selectWinner(winnerId);
    if (!result.success) {
      console.warn("[useBots] Bot judge select-winner failed:", result.reason);
    }
    return result.success;
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

      // Round > 1: add a base delay so bots don't submit while the
      // round-won celebration overlay is still animating out on clients.
      // The host clears winnerSelected synchronously, but other clients
      // may still be showing the overlay when the new round's gameState
      // arrives. 2.5s is enough for the overlay dismiss + brief breathing room.
      const BASE_DELAY_MS = state.round > 1 ? 2500 : 0;
      let staggerIndex = 0;

      for (const bot of botPlayers.value) {
        const actionKey = `play-${bot.userId}-${state.round}`;
        if (botActionsInFlight.has(actionKey)) continue;
        if (state.submissions?.[bot.userId]) continue; // Already submitted
        if (state.judgeId === bot.userId) continue; // Judge doesn't play

        const delay = BASE_DELAY_MS + staggerIndex * BOT_STAGGER_MS;
        staggerIndex++;

        botActionsInFlight.add(actionKey);
        const timer = setTimeout(() => {
          try {
            botPlayCards(bot.userId);
          } finally {
            botActionsInFlight.delete(actionKey);
          }
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
          const currentRound = state.round;
          const revealTimer = setTimeout(() => {
            // Guard: ensure we're still in judging phase for the same round.
            // If the game moved on (e.g., phase transition or new round), skip.
            const currentState = gameState.value;
            if (
              !currentState ||
              currentState.phase !== "judging" ||
              currentState.round !== currentRound
            ) {
              return;
            }
            botRevealCard(playerId);
          }, totalDelay);
          pendingBotTimers.push(revealTimer);
          totalDelay += REVEAL_STAGGER_MS;
        }

        // After all reveals + thinking delay, pick a winner
        totalDelay += THINKING_DELAY_MS;
        const judgeTimer = setTimeout(() => {
          try {
            botSelectWinner();
          } finally {
            botActionsInFlight.delete(actionKey);
          }
        }, totalDelay);
        pendingBotTimers.push(judgeTimer);
      }
    }

    if (phase === "complete") {
      // Game over — do NOT remove bots here.
      // Bots stay visible in the leaderboard/GameOver screen.
      // They will be cleaned up when the lobby resets back to "waiting"
      // (handled by a separate phase transition watcher below).
      return;
    }
  };

  // ─── Bot Cleanup on Lobby Reset ───────────────────────────────────────
  // When the lobby transitions from "complete" → "waiting" (via resetGameState),
  // remove all bots so the host starts fresh in the new waiting room.
  let previousPhase: string | null = null;
  const stopPhaseWatcher = watch(
    gameState,
    (newState) => {
      const currentPhase = newState?.phase ?? null;
      if (
        previousPhase === "complete" &&
        currentPhase === "waiting" &&
        isHost.value
      ) {
        removeAllBots();
      }
      previousPhase = currentPhase;
    },
    { immediate: true },
  );

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
      stopPhaseWatcher();
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
