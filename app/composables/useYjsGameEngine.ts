// composables/useYjsGameEngine.ts
// Client-side game engine — replaces 10 server API routes with direct Y.Doc mutations.
//
// All game logic (play cards, judge, next round, etc.) runs locally and syncs
// via Teleportal. Only the initial card fetch at game start uses a Nitro API call.
//
// Architecture:
//   - Each action reads the current state from the Y.Doc
//   - Validates the action is legal (correct phase, correct player, etc.)
//   - Mutates the Y.Doc inside a transact() block
//   - Teleportal syncs the update to all connected clients
//
// Usage:
//   const lobbyDoc = useLobbyDoc()
//   const engine = useYjsGameEngine(lobbyDoc)
//   engine.playCard(["card-1", "card-2"])

import type { LobbyDocResult } from "~/composables/useLobbyDoc";
import type { PlayerId, CardId } from "~/types/game";
import type { CardTexts } from "~/types/gamecards";

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeParseJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Merge chunked cardTexts keys (cardTexts_0, cardTexts_1, ...) from a Y.Map.
 *  startGame splits card texts across multiple keys to stay under Teleportal's
 *  ~64KB message limit. Falls back to the legacy flat "cardTexts" key. */
function mergeCardTexts(c: { get(key: string): string | undefined }): CardTexts {
  const numChunks = parseInt(c.get("cardTextsChunks") || "0", 10);
  if (numChunks > 0) {
    const merged: CardTexts = {};
    for (let i = 0; i < numChunks; i++) {
      Object.assign(merged, safeParseJson(c.get(`cardTexts_${i}`), {}));
    }
    // Also merge the flat key so replenished white cards are included
    Object.assign(merged, safeParseJson(c.get("cardTexts"), {}));
    return merged;
  }
  return safeParseJson<CardTexts>(c.get("cardTexts"), {});
}

/** Fisher-Yates shuffle (in-place) */
function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
  return array;
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useYjsGameEngine(lobbyDoc: LobbyDocResult) {
  const {
    doc,
    getGameState,
    getCards,
    getHands,
    getPlayers,
    getMeta,
    getChat,
  } = lobbyDoc;
  const userStore = useUserStore();

  const requireDoc = () => {
    if (!doc.value) throw new Error("[GameEngine] No active Y.Doc");
    return doc.value;
  };

  const myId = (): PlayerId => userStore.user?.$id ?? "";

  // ── State Readers (from Y.Doc) ─────────────────────────────────────────

  const readGameState = () => {
    const gs = getGameState();
    return {
      phase: gs.get("phase") as string,
      round: gs.get("round") as number,
      judgeId: gs.get("judgeId") as string | null,
      blackCard: safeParseJson<{
        id: string;
        text: string;
        pick: number;
        pack?: string;
      } | null>(gs.get("blackCard"), null),
      submissions: safeParseJson<Record<PlayerId, CardId[]>>(
        gs.get("submissions"),
        {},
      ),
      scores: safeParseJson<Record<PlayerId, number>>(gs.get("scores"), {}),
      playerOrder: safeParseJson<PlayerId[]>(gs.get("playerOrder"), []),
      skippedPlayers: safeParseJson<PlayerId[]>(gs.get("skippedPlayers"), []),
      revealedCards: safeParseJson<Record<PlayerId, boolean>>(
        gs.get("revealedCards"),
        {},
      ),
      config: safeParseJson<{ maxPoints: number }>(gs.get("config"), {
        maxPoints: 10,
      }),
    };
  };

  const readCards = () => {
    const c = getCards();
    return {
      whiteDeck: safeParseJson<CardId[]>(c.get("whiteDeck"), []),
      blackDeck: safeParseJson<CardId[]>(c.get("blackDeck"), []),
      discardWhite: safeParseJson<CardId[]>(c.get("discardWhite"), []),
      discardBlack: safeParseJson<CardId[]>(c.get("discardBlack"), []),
    };
  };

  const readHand = (playerId: PlayerId): CardId[] => {
    return safeParseJson<CardId[]>(getHands().get(playerId), []);
  };

  /**
   * Returns IDs of active game participants (players + bots).
   * Excludes spectators so they don't inflate eligible-player counts.
   */
  const getActivePlayerIds = (): PlayerId[] => {
    const result: PlayerId[] = [];
    for (const [pid, raw] of getPlayers().entries()) {
      const p = safeParseJson<{ playerType?: string }>(raw, {});
      if (
        p.playerType === "player" ||
        p.playerType === "bot" ||
        !p.playerType
      ) {
        result.push(pid);
      }
    }
    return result;
  };

  // ── Deck Replenishment ─────────────────────────────────────────────────
  // When the white card deck runs low, the host fetches fresh cards from
  // Appwrite instead of recycling the discard pile. This keeps games fresh.

  const DECK_LOW_THRESHOLD = 50;
  let replenishing = false;

  /**
   * Collects every white card ID currently tracked in the Y.Doc
   * (deck + hands + discard + active submissions).
   */
  const collectAllUsedWhiteIds = (): string[] => {
    const cards = readCards();
    const state = readGameState();
    const used: string[] = [...cards.whiteDeck, ...cards.discardWhite];
    // All hands
    for (const [, rawHand] of getHands().entries()) {
      used.push(...safeParseJson<string[]>(rawHand, []));
    }
    // Active submissions
    for (const cardIds of Object.values(state.submissions)) {
      used.push(...(cardIds as string[]));
    }
    return used;
  };

  /**
   * Fetches fresh white cards from the server and merges them into the Y.Doc.
   * Only the host should call this to avoid duplicate fetches.
   */
  const replenishWhiteDeck = async (count: number = 200): Promise<void> => {
    if (replenishing) return;
    replenishing = true;

    try {
      const packs = safeParseJson<string[]>(
        lobbyDoc.getSettings().get("cardPacks"),
        [],
      );
      const excludeIds = collectAllUsedWhiteIds();

      const result = await $fetch<{
        success: boolean;
        cardIds: string[];
        cardTexts: Record<string, { text: string; pack: string }>;
      }>("/api/game/draw-cards", {
        method: "POST",
        body: { cardPacks: packs, excludeIds, count },
      });

      if (!result?.success || result.cardIds.length === 0) {
        console.warn(
          "[GameEngine] No fresh cards available — recycling discard pile",
        );

        // Last resort: reshuffle discard pile back into deck
        const ydoc = requireDoc();
        ydoc.transact(() => {
          const c = getCards();
          const deck = safeParseJson<string[]>(c.get("whiteDeck"), []);
          const discard = safeParseJson<string[]>(c.get("discardWhite"), []);

          if (discard.length > 0) {
            deck.push(...shuffle([...discard]));
            c.set("whiteDeck", JSON.stringify(deck));
            c.set("discardWhite", "[]");
          }
        });
        return;
      }

      const ydoc = requireDoc();
      ydoc.transact(() => {
        const c = getCards();

        // Append new IDs to deck
        const deck = safeParseJson<string[]>(c.get("whiteDeck"), []);
        deck.push(...result.cardIds);
        c.set("whiteDeck", JSON.stringify(deck));

        // Merge new texts into cardTexts
        const texts = safeParseJson<Record<string, any>>(
          c.get("cardTexts"),
          {},
        );
        Object.assign(texts, result.cardTexts);
        c.set("cardTexts", JSON.stringify(texts));
      });

      console.log(
        `[GameEngine] Replenished deck with ${result.cardIds.length} fresh cards`,
      );
    } catch (err) {
      console.warn("[GameEngine] Failed to replenish deck:", err);
    } finally {
      replenishing = false;
    }
  };

  /**
   * Checks deck level and triggers an async replenish if the current user
   * is the host and the deck is running low.
   */
  const scheduleReplenishIfNeeded = (): void => {
    try {
      const isHostUser = getMeta().get("hostUserId") === myId();
      if (!isHostUser) return;

      const deckSize = safeParseJson<string[]>(
        getCards().get("whiteDeck"),
        [],
      ).length;

      if (deckSize < DECK_LOW_THRESHOLD) {
        replenishWhiteDeck().catch((err) =>
          console.warn("[GameEngine] Background replenish failed:", err),
        );
      }
    } catch {
      // Y.Doc may have been destroyed — safe to ignore
    }
  };

  // ── Play Card ──────────────────────────────────────────────────────────
  // Replaces: POST /api/game/play-card

  const playCard = (
    cardIds: CardId[],
    playerId?: PlayerId,
  ): { success: boolean; reason?: string } => {
    const pid = playerId ?? myId();
    const ydoc = requireDoc();
    const state = readGameState();

    // Validation
    if (state.phase !== "submitting")
      return { success: false, reason: "Not in submitting phase" };
    if (state.judgeId === pid)
      return { success: false, reason: "Judge cannot submit cards" };
    if (state.submissions[pid])
      return { success: false, reason: "Already submitted" };
    if (state.skippedPlayers.includes(pid))
      return { success: false, reason: "Player is skipped" };

    const hand = readHand(pid);
    const hasAllCards = cardIds.every((id) => hand.includes(id));
    if (!hasAllCards) return { success: false, reason: "Cards not in hand" };

    ydoc.transact(() => {
      const gs = getGameState();
      const hands = getHands();

      // Remove played cards from hand
      const newHand = hand.filter((id) => !cardIds.includes(id));
      hands.set(pid, JSON.stringify(newHand));

      // Add submission
      const submissions = safeParseJson<Record<string, string[]>>(
        gs.get("submissions"),
        {},
      );
      submissions[pid] = cardIds;
      gs.set("submissions", JSON.stringify(submissions));

      // Check if all eligible players have submitted
      const allPlayerIds = getActivePlayerIds();
      const eligiblePlayers = allPlayerIds.filter(
        (id) => id !== state.judgeId && !state.skippedPlayers.includes(id),
      );
      if (Object.keys(submissions).length >= eligiblePlayers.length) {
        gs.set("phase", "submitting-complete");
        // Short delay then transition to judging — let the UI animate
        // The actual phase transition happens client-side after animations
        setTimeout(() => {
          ydoc.transact(() => {
            gs.set("phase", "judging");
          });
        }, 500);
      }
    });

    return { success: true };
  };

  // ── Reveal Card ────────────────────────────────────────────────────────
  // Replaces: POST /api/game/reveal-card

  const revealCard = (
    playerId: PlayerId,
  ): { success: boolean; reason?: string } => {
    const ydoc = requireDoc();
    const state = readGameState();

    if (state.phase !== "judging")
      return { success: false, reason: "Not in judging phase" };
    if (!state.submissions[playerId])
      return { success: false, reason: "Player has no submission" };

    ydoc.transact(() => {
      const gs = getGameState();
      const revealed = safeParseJson<Record<string, boolean>>(
        gs.get("revealedCards"),
        {},
      );
      revealed[playerId] = true;
      gs.set("revealedCards", JSON.stringify(revealed));
    });

    return { success: true };
  };

  // ── Select Winner ──────────────────────────────────────────────────────
  // Replaces: POST /api/game/select-winner

  const selectWinner = (
    winnerId: PlayerId,
  ): { success: boolean; reason?: string; phase?: string } => {
    const ydoc = requireDoc();
    const state = readGameState();
    const cards = readCards();

    if (state.phase !== "judging")
      return { success: false, reason: "Not in judging phase" };
    if (!state.submissions[winnerId])
      return { success: false, reason: "Winner has no submission" };

    let finalPhase = "roundEnd";

    ydoc.transact(() => {
      const gs = getGameState();
      const c = getCards();

      // Award point
      const scores = { ...state.scores };
      scores[winnerId] = (scores[winnerId] || 0) + 1;
      gs.set("scores", JSON.stringify(scores));

      // Store winning cards
      const winningCards = state.submissions[winnerId] || [];
      gs.set("winningCards", JSON.stringify(winningCards));
      gs.set("roundWinner", winnerId);

      // Discard played white cards
      const discardWhite = [...cards.discardWhite];
      for (const cardIds of Object.values(state.submissions)) {
        discardWhite.push(...cardIds);
      }
      c.set("discardWhite", JSON.stringify(discardWhite));

      // Discard black card
      const discardBlack = [...cards.discardBlack];
      if (state.blackCard?.id) {
        discardBlack.push(state.blackCard.id);
      }
      c.set("discardBlack", JSON.stringify(discardBlack));

      // Check win condition
      const maxScore = Math.max(...Object.values(scores));
      const winScore = state.config?.maxPoints || 10;

      if (maxScore >= winScore) {
        finalPhase = "complete";
        gs.set("phase", "complete");
        gs.set("roundEndStartTime", null);
        gs.set("gameEndTime", Date.now());
        getMeta().set("status", "complete");
      } else {
        finalPhase = "roundEnd";
        gs.set("phase", "roundEnd");
        gs.set("roundEndStartTime", Date.now());
      }
    });

    return { success: true, phase: finalPhase };
  };

  // ── Next Round ─────────────────────────────────────────────────────────
  // Replaces: POST /api/game/next-round

  const nextRound = (): { success: boolean; reason?: string } => {
    // Only the host advances rounds — prevents two clients racing into this
    // simultaneously (e.g., both see roundEnd and fire the transition at once).
    const isHostUser = getMeta().get("hostUserId") === myId();
    if (!isHostUser)
      return { success: false, reason: "Only the host can advance rounds" };

    const ydoc = requireDoc();
    const state = readGameState();
    const cards = readCards();

    if (state.phase !== "roundEnd")
      return { success: false, reason: "Not in roundEnd phase" };

    ydoc.transact(() => {
      const gs = getGameState();
      const c = getCards();
      const handsMap = getHands();

      // Rotate judge
      const order = state.playerOrder;
      const currentJudgeIdx = order.indexOf(state.judgeId ?? "");
      let nextJudgeIdx = (currentJudgeIdx + 1) % order.length;
      // Skip players who aren't in the game anymore (excludes spectators)
      const activePlayers = new Set(getActivePlayerIds());
      let attempts = 0;
      while (
        !activePlayers.has(order[nextJudgeIdx]!) &&
        attempts < order.length
      ) {
        nextJudgeIdx = (nextJudgeIdx + 1) % order.length;
        attempts++;
      }
      const newJudgeId = order[nextJudgeIdx]!;
      gs.set("judgeId", newJudgeId);

      // Draw new black card (respecting maxPick setting)
      let blackDeck = [...cards.blackDeck];
      let discardBlack = [...cards.discardBlack];
      const maxPick = safeParseJson<number>(
        lobbyDoc.getSettings().get("maxPick"),
        3,
      );

      // Look up the card text from the embedded cardTexts (chunked keys)
      const cardTexts = mergeCardTexts(getCards());

      // Find next eligible black card (pick <= maxPick)
      let newBlackCardId: string | null = null;
      let reshuffled = false;
      while (!newBlackCardId) {
        if (blackDeck.length === 0) {
          if (reshuffled) break; // Avoid infinite loop
          blackDeck = shuffle([...discardBlack]);
          discardBlack = [];
          reshuffled = true;
          if (blackDeck.length === 0) break;
        }
        const candidateId = blackDeck.pop()!;
        const candidateEntry = cardTexts[candidateId];
        if ((candidateEntry?.pick ?? 1) <= maxPick) {
          newBlackCardId = candidateId;
        } else {
          discardBlack.push(candidateId);
        }
      }

      const cardEntry = newBlackCardId ? cardTexts[newBlackCardId] : null;
      const newBlackCard = newBlackCardId
        ? {
            id: newBlackCardId,
            text: cardEntry?.text ?? "Unknown card",
            pick: cardEntry?.pick ?? 1,
            pack: cardEntry?.pack ?? "",
          }
        : { id: "", text: "No eligible cards remain", pick: 1, pack: "" };
      gs.set("blackCard", JSON.stringify(newBlackCard));
      c.set("blackDeck", JSON.stringify(blackDeck));
      c.set("discardBlack", JSON.stringify(discardBlack));

      // Refill player hands (draw from deck only — no discard recycling).
      // IMPORTANT: Read whiteDeck fresh from the Y.Doc *inside* this transaction
      // so we always operate on the current committed deck state. Reading from the
      // outer `cards` snapshot (captured before transact) would allow two clients
      // to draw from the same stale deck, producing duplicate/missing cards.
      const manualDraw = lobbyDoc.getSettings().get("manualDraw");
      if (!manualDraw) {
        const whiteDeck = safeParseJson<CardId[]>(c.get("whiteDeck"), []);
        const numCards = safeParseJson<number>(
          lobbyDoc.getSettings().get("cardsPerPlayer"),
          10,
        );

        for (const [playerId, rawHand] of handsMap.entries()) {
          const hand = safeParseJson<CardId[]>(rawHand, []);
          const deficit = numCards - hand.length;

          if (deficit > 0) {
            const newCards = whiteDeck.splice(
              0,
              Math.min(deficit, whiteDeck.length),
            );
            hand.push(...newCards);
            handsMap.set(playerId, JSON.stringify(hand));
          }
        }

        c.set("whiteDeck", JSON.stringify(whiteDeck));
      }

      // Clear round state
      gs.set("submissions", "{}");
      gs.set("roundWinner", null);
      gs.set("winningCards", "[]");
      gs.set("roundEndStartTime", null);
      gs.set("revealedCards", "{}");
      gs.set("readAloudText", "");
      gs.set("skippedPlayers", "[]");
      gs.set("round", state.round + 1);
      gs.set("phase", "submitting");
    });

    // Async: replenish deck if running low (host only)
    scheduleReplenishIfNeeded();

    return { success: true };
  };

  // ── Skip Player ────────────────────────────────────────────────────────
  // Replaces: POST /api/game/skip-player

  const skipPlayer = (
    playerId: PlayerId,
  ): { success: boolean; reason?: string } => {
    const ydoc = requireDoc();
    const state = readGameState();

    if (state.phase !== "submitting")
      return { success: false, reason: "Not in submitting phase" };
    if (state.judgeId === playerId)
      return { success: false, reason: "Cannot skip the judge" };
    if (state.skippedPlayers.includes(playerId))
      return { success: false, reason: "Already skipped" };

    ydoc.transact(() => {
      const gs = getGameState();
      const skipped = [...state.skippedPlayers, playerId];
      gs.set("skippedPlayers", JSON.stringify(skipped));

      // Check if all remaining players have submitted
      const allPlayerIds = getActivePlayerIds();
      const eligible = allPlayerIds.filter(
        (id) => id !== state.judgeId && !skipped.includes(id),
      );
      const submissions = safeParseJson<Record<string, any>>(
        gs.get("submissions"),
        {},
      );
      if (Object.keys(submissions).length >= eligible.length) {
        gs.set("phase", "judging");
      }
    });

    return { success: true };
  };

  // ── Skip Judge ─────────────────────────────────────────────────────────
  // Replaces: POST /api/game/skip-judge

  const skipJudge = (): { success: boolean; reason?: string } => {
    const ydoc = requireDoc();
    const state = readGameState();

    if (state.phase !== "judging")
      return { success: false, reason: "Not in judging phase" };

    ydoc.transact(() => {
      const gs = getGameState();
      // No winner this round — move to roundEnd with no score change
      gs.set("roundWinner", null);
      gs.set("winningCards", "[]");
      gs.set("phase", "roundEnd");
      gs.set("roundEndStartTime", Date.now());
    });

    return { success: true };
  };

  // ── Read Aloud ─────────────────────────────────────────────────────────
  // Replaces: POST /api/game/read-aloud

  const setReadAloud = (text: string): void => {
    requireDoc().transact(() => {
      getGameState().set("readAloudText", text);
    });
  };

  // ── Convert Spectator ──────────────────────────────────────────────────
  // Replaces: POST /api/game/convert-spectator

  const convertToPlayer = (
    playerId: PlayerId,
  ): { success: boolean; reason?: string; cardsDealt?: number } => {
    const ydoc = requireDoc();
    const rawPlayer = getPlayers().get(playerId);
    if (!rawPlayer) return { success: false, reason: "Player not found" };

    const player = safeParseJson<any>(rawPlayer, null);
    if (!player) return { success: false, reason: "Malformed player data" };
    if (player.playerType !== "spectator")
      return { success: false, reason: "Not a spectator" };

    const state = readGameState();
    const cards = readCards();
    const numCards = safeParseJson<number>(
      lobbyDoc.getSettings().get("cardsPerPlayer"),
      10,
    );

    // Deal from the deck directly — no discard recycling
    const whiteDeck = [...cards.whiteDeck];
    const cardsAvailable = Math.min(numCards, whiteDeck.length);

    if (cardsAvailable === 0) {
      return {
        success: false,
        reason: "Not enough cards in deck to deal a hand",
      };
    }

    const newHand = whiteDeck.splice(0, cardsAvailable);

    ydoc.transact(() => {
      const gs = getGameState();
      const c = getCards();
      const handsMap = getHands();

      // Flip player type
      player.playerType = "player";
      getPlayers().set(playerId, JSON.stringify(player));

      // Deal hand
      handsMap.set(playerId, JSON.stringify(newHand));

      // Update deck
      c.set("whiteDeck", JSON.stringify(whiteDeck));

      // Initialize score to 0 if not present
      const scores = safeParseJson<Record<string, number>>(
        gs.get("scores"),
        {},
      );
      if (scores[playerId] === undefined) {
        scores[playerId] = 0;
        gs.set("scores", JSON.stringify(scores));
      }

      // Add to playerOrder if not already present
      const order = safeParseJson<string[]>(gs.get("playerOrder"), []);
      if (!order.includes(playerId)) {
        order.push(playerId);
        gs.set("playerOrder", JSON.stringify(order));
      }
    });

    // Async: replenish deck if running low (host only)
    scheduleReplenishIfNeeded();

    return { success: true, cardsDealt: cardsAvailable };
  };

  // ── Reset Game ─────────────────────────────────────────────────────────
  // Resets the lobby back to waiting state for a new game

  const resetGame = (): void => {
    const ydoc = requireDoc();
    ydoc.transact(() => {
      const gs = getGameState();
      gs.set("phase", "waiting");
      gs.set("round", 0);
      gs.set("judgeId", null);
      gs.set("blackCard", null);
      gs.set("submissions", "{}");
      gs.set("scores", "{}");
      gs.set("roundWinner", null);
      gs.set("winningCards", "[]");
      gs.set("roundEndStartTime", null);
      gs.set("skippedPlayers", "[]");
      gs.set("revealedCards", "{}");
      gs.set("readAloudText", "");
      gs.set("gameEndTime", null);
      gs.set("returnedToLobby", "{}");

      getMeta().set("status", "waiting");

      // Clear cards and hands
      const c = getCards();
      c.set("whiteDeck", "[]");
      c.set("blackDeck", "[]");
      c.set("discardWhite", "[]");
      c.set("discardBlack", "[]");

      // Clear all hands
      const hands = getHands();
      for (const key of [...hands.keys()]) {
        hands.delete(key);
      }
    });
  };

  // ── Returned to Lobby (post-game waiting) ──────────────────────────────

  const markReturnedToLobby = (playerId?: PlayerId): void => {
    const pid = playerId ?? myId();
    requireDoc().transact(() => {
      const gs = getGameState();
      const returned = safeParseJson<Record<string, boolean>>(
        gs.get("returnedToLobby"),
        {},
      );
      returned[pid] = true;
      gs.set("returnedToLobby", JSON.stringify(returned));
    });
  };

  // ── Handle Player Leave (mid-game) ──────────────────────────────────
  // Replaces: POST /api/game/player-leave
  // Cleans up game state when a player departs. Handles:
  //   - Judge left: skip round, rotate judge, draw new black card
  //   - Non-judge left during submission: advance to judging if all others submitted
  //   - General cleanup: remove from hands, submissions, skippedPlayers

  const handlePlayerLeave = (leavingUserId: PlayerId): void => {
    const ydoc = requireDoc();
    const state = readGameState();
    const cards = readCards();

    // Only process if game is actively being played
    if (state.phase === "waiting" || state.phase === "complete") return;

    ydoc.transact(() => {
      const gs = getGameState();
      const c = getCards();
      const handsMap = getHands();
      const playersMap = getPlayers();

      // Remove leaving player from hands and submissions
      handsMap.delete(leavingUserId);
      const submissions = { ...state.submissions };
      delete submissions[leavingUserId];
      gs.set("submissions", JSON.stringify(submissions));

      // Remove from skippedPlayers
      const skipped = state.skippedPlayers.filter(
        (id: string) => id !== leavingUserId,
      );
      gs.set("skippedPlayers", JSON.stringify(skipped));

      // Count remaining active players
      const remainingPlayerIds: string[] = [];
      for (const [pid] of playersMap.entries()) {
        if (pid !== leavingUserId) {
          try {
            const p = JSON.parse(playersMap.get(pid) || "{}");
            if (p.playerType !== "spectator") {
              remainingPlayerIds.push(pid);
            }
          } catch {
            remainingPlayerIds.push(pid);
          }
        }
      }

      // Too few players → revert to waiting
      if (remainingPlayerIds.length < 3) {
        gs.set("phase", "waiting");
        getMeta().set("status", "waiting");
        return;
      }

      // Case 1: Judge left → skip round, rotate judge, draw new black card
      if (leavingUserId === state.judgeId) {
        // Discard current black card
        const discardBlack = [...cards.discardBlack];
        if (state.blackCard?.id) {
          discardBlack.push(state.blackCard.id);
        }

        // Discard all submitted white cards
        const discardWhite = [...cards.discardWhite];
        for (const submittedCards of Object.values(submissions)) {
          discardWhite.push(...(submittedCards as string[]));
        }

        // Reset submissions
        gs.set("submissions", "{}");

        // Rotate judge — pick next in order
        const handPlayerIds = [...handsMap.keys()];
        const newJudgeId = handPlayerIds[0] || remainingPlayerIds[0] || "";
        gs.set("judgeId", newJudgeId);

        // Draw new black card (respecting maxPick setting)
        let blackDeck = [...cards.blackDeck];
        const maxPick = safeParseJson<number>(
          lobbyDoc.getSettings().get("maxPick"),
          3,
        );
        const cardTexts = mergeCardTexts(c);

        // Find next eligible black card (pick <= maxPick)
        let nextBlackId: string | null = null;
        let reshuffled = false;
        while (!nextBlackId) {
          if (blackDeck.length === 0) {
            if (reshuffled) break;
            blackDeck = shuffle([...discardBlack]);
            discardBlack.length = 0;
            reshuffled = true;
            if (blackDeck.length === 0) break;
          }
          const candidateId = blackDeck.pop()!;
          const candidateEntry = cardTexts[candidateId];
          if ((candidateEntry?.pick ?? 1) <= maxPick) {
            nextBlackId = candidateId;
          } else {
            discardBlack.push(candidateId);
          }
        }

        if (nextBlackId) {
          const entry = cardTexts[nextBlackId];
          gs.set(
            "blackCard",
            JSON.stringify({
              id: nextBlackId,
              text: entry?.text ?? "Unknown card",
              pick: entry?.pick ?? 1,
              pack: entry?.pack ?? "",
            }),
          );
        } else {
          gs.set("blackCard", null);
        }

        c.set("blackDeck", JSON.stringify(blackDeck));
        c.set("discardBlack", JSON.stringify(discardBlack));
        c.set("discardWhite", JSON.stringify(discardWhite));

        // Refill hands for players who submitted (draw from deck only)
        const numCards = safeParseJson<number>(
          lobbyDoc.getSettings().get("cardsPerPlayer"),
          10,
        );
        const whiteDeck = safeParseJson<CardId[]>(c.get("whiteDeck"), []);

        for (const [pid, rawHand] of handsMap.entries()) {
          const hand = safeParseJson<CardId[]>(rawHand, []);
          const deficit = numCards - hand.length;
          if (deficit > 0) {
            const newCards = whiteDeck.splice(
              0,
              Math.min(deficit, whiteDeck.length),
            );
            hand.push(...newCards);
            handsMap.set(pid, JSON.stringify(hand));
          }
        }

        c.set("whiteDeck", JSON.stringify(whiteDeck));

        // Reset round state
        gs.set("revealedCards", "{}");
        gs.set("skippedPlayers", "[]");
        gs.set("phase", "submitting");
        return;
      }

      // Case 2: Non-judge left during submission phase
      if (state.phase === "submitting") {
        const eligible = remainingPlayerIds.filter(
          (id) => id !== state.judgeId && !skipped.includes(id),
        );
        if (
          Object.keys(submissions).length >= eligible.length &&
          eligible.length > 0
        ) {
          gs.set("phase", "judging");
        }
        return;
      }

      // Case 3: Non-judge left during judging — no phase change needed,
      // judge can still pick from remaining submissions
    });

    // Async: replenish deck if running low (host only)
    scheduleReplenishIfNeeded();
  };

  // ── Manual Draw ──────────────────────────────────────────────────────
  // When manualDraw setting is enabled, players draw their own cards
  // by clicking the white deck instead of auto-receiving them.

  const drawCards = (
    playerId?: PlayerId,
  ): { success: boolean; reason?: string; drawnCount?: number } => {
    const ydoc = requireDoc();
    const state = readGameState();
    const pid = playerId ?? myId();

    if (state.phase !== "submitting")
      return { success: false, reason: "Can only draw during submitting phase" };

    const manualDraw = lobbyDoc.getSettings().get("manualDraw");
    if (!manualDraw)
      return { success: false, reason: "Manual draw is not enabled" };

    let drawnCount = 0;

    ydoc.transact(() => {
      const c = getCards();
      const handsMap = getHands();
      const rawHand = handsMap.get(pid);
      if (!rawHand) return;

      const hand = safeParseJson<CardId[]>(rawHand, []);
      const numCards = safeParseJson<number>(
        lobbyDoc.getSettings().get("cardsPerPlayer"),
        10,
      );
      const deficit = numCards - hand.length;
      if (deficit <= 0) return;

      const whiteDeck = safeParseJson<CardId[]>(c.get("whiteDeck"), []);
      const newCards = whiteDeck.splice(0, Math.min(deficit, whiteDeck.length));
      hand.push(...newCards);
      handsMap.set(pid, JSON.stringify(hand));
      c.set("whiteDeck", JSON.stringify(whiteDeck));
      drawnCount = newCards.length;
    });

    return { success: true, drawnCount };
  };

  return {
    readHand,
    playCard,
    revealCard,
    selectWinner,
    nextRound,
    skipPlayer,
    skipJudge,
    setReadAloud,
    convertToPlayer,
    resetGame,
    markReturnedToLobby,
    handlePlayerLeave,
    replenishWhiteDeck,
    drawCards,
  };
}
