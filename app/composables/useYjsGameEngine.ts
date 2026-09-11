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
import { mergeCardTextKeys } from "~/utils/cardTexts";
import {
  chunkEntries,
  readChunkedArray,
  readChunkedRecord,
  splitArrayChunks,
} from "~/utils/chunkedDocValue";
import { shuffle } from "~/utils/shuffle";
import { drawEligibleBlackCard } from "~/utils/blackCardDraw";

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeParseJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Pick counts for black cards, keyed by card id.
 *
 *  This is the only card metadata the engine needs synchronously: nextRound()
 *  runs inside a transact() and its eligibility loop reads `pick` for every
 *  candidate it considers, including ones it skips. No card text is involved —
 *  that is resolved per client by useCardTexts.
 *
 *  Falls back to the pick values embedded in the old chunked cardTexts keys so
 *  a game already in flight when this shipped keeps advancing. */
function readBlackPicks(c: {
  entries(): IterableIterator<[string, any]>;
}): Record<string, number> {
  const raw = Object.fromEntries(c.entries());
  // Chunk-aware: with every pack enabled the pick map is ~58KB, too big for a
  // single Y.Doc update to survive the trip to the server. Falls back to the
  // plain key for documents written before chunking.
  const picks = readChunkedRecord<number>(raw, "blackPicks");
  if (Object.keys(picks).length > 0) return picks;

  const legacy: CardTexts = mergeCardTextKeys(raw);
  const fallback: Record<string, number> = {};
  for (const [id, entry] of Object.entries(legacy)) {
    if (typeof entry?.pick === "number") fallback[id] = entry.pick;
  }
  return fallback;
}

/**
 * Writes the black deck across chunk keys.
 *
 * With every pack enabled the deck is ~55KB, close enough to the ~58KB ceiling
 * above which a single update is silently dropped on its way to the server that
 * it is not worth writing whole. Stale chunks from a longer previous deck are
 * blanked rather than deleted, so a reader that has already seen a higher chunk
 * count cannot pick up leftovers.
 */
function writeBlackDeck(
  c: { set(k: string, v: unknown): void; get(k: string): unknown },
  deck: CardId[],
): void {
  const previous = parseInt(String(c.get("blackDeckChunks") ?? "0"), 10) || 0;
  const chunks = splitArrayChunks(deck);
  for (const [key, value] of chunkEntries("blackDeck", chunks)) {
    c.set(key, value);
  }
  for (let i = chunks.length; i < previous; i++) {
    c.set(`blackDeck_${i}`, "[]");
  }
  // The plain key is no longer authoritative; blank it so a legacy reader that
  // ignores chunks fails visibly rather than replaying a stale deck.
  c.set("blackDeck", "[]");
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useYjsGameEngine(lobbyDoc: LobbyDocResult) {
  let $activityFetch: typeof $fetch =
    typeof $fetch !== "undefined"
      ? $fetch
      : (globalThis as any).$fetch;
  try {
    const nuxtApp = useNuxtApp();
    if ((nuxtApp as any)?.$activityFetch) {
      $activityFetch = (nuxtApp as any).$activityFetch;
    }
  } catch {
    // Outside Nuxt app context (e.g. unit tests)
  }

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

  const myId = (): PlayerId => userStore.user?.id ?? "";

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
      promptSerial: (gs.get("promptSerial") as number) ?? 0,
      blackSkipUsed: safeParseJson<boolean>(gs.get("blackSkipUsed"), false),
    };
  };

  const readCards = () => {
    const c = getCards();
    return {
      whiteDeck: safeParseJson<CardId[]>(c.get("whiteDeck"), []),
      blackDeck: readChunkedArray<CardId>(
        Object.fromEntries(c.entries()),
        "blackDeck",
      ),
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

  /** Resolves the lobby's Postgres row id from the join code in the Y.Doc. */
  const resolveLobbyId = async (): Promise<string | null> => {
    const code = lobbyDoc.lobbyCode.value;
    if (!code) return null;
    const record = await $activityFetch<{ id: string } | null>(
      `/api/lobby/by-code/${code}`,
    );
    return record?.id ?? null;
  };

  /**
   * Mirrors a spectator -> player conversion into the players table.
   *
   * The Y.Doc is authoritative for gameplay, but Postgres keeps its own
   * playerType column that nothing was updating, so a converted spectator
   * stayed a spectator there forever. Fire-and-forget: the conversion has
   * already happened in the doc and must not be blocked on this.
   */
  const mirrorConversionToServer = async (playerId: PlayerId): Promise<void> => {
    try {
      const lobbyId = await resolveLobbyId();
      if (!lobbyId) return;
      await $activityFetch("/api/players/convert", {
        method: "POST",
        body: { lobbyId, playerId },
      });
    } catch (err) {
      console.warn(
        "[GameEngine] Failed to mirror spectator conversion to server:",
        err,
      );
    }
  };

  const isBot = (playerId: PlayerId): boolean =>
    safeParseJson<{ playerType?: string }>(getPlayers().get(playerId), {})
      .playerType === "bot";

  /**
   * Records one finished round's statistics in Postgres: card counters, and —
   * for docs stamped with a gameId — per-player counters.
   *
   * `white_cards.times_played` / `times_won` and `black_cards.times_played`
   * have existed since the initial migration with nothing to write them — the
   * game runs client-side in the Y.Doc, so no server route ever knew a round
   * had ended. One actor reports each round (see the call site), and the
   * server's (gameId, round) ledger absorbs any double-fire.
   *
   * Bots are never credited. A bot's submission is dropped from the played
   * and submitter lists, a bot winner is sent as `winnerId: null` with no
   * `wonWhiteIds`, and a bot-judged round is flagged `botJudged` so the server
   * credits no judge and leaves card counters to human picks. A bot-judged
   * round in a doc without a gameId would change nothing, so it is not sent.
   *
   * Fire-and-forget: the round is decided and must not block on this.
   */
  const reportRoundStats = async (report: {
    submissions: Record<string, CardId[]>;
    winnerId: PlayerId;
    blackCardId: string | null;
    gameId: string | null;
    round: number;
    botJudged: boolean;
    gameOver: boolean;
    participantIds: PlayerId[];
  }): Promise<void> => {
    try {
      if (report.botJudged && !report.gameId) return;

      const playedWhiteIds: CardId[] = [];
      const submitterIds: PlayerId[] = [];
      for (const [pid, cardIds] of Object.entries(report.submissions)) {
        if (isBot(pid)) continue;
        submitterIds.push(pid);
        playedWhiteIds.push(...cardIds);
      }
      // An all-bot round carries no signal worth a round trip — unless it
      // ends the game, where every human participant is still owed a game.
      if (submitterIds.length === 0 && !report.gameOver) return;

      const winnerIsBot = isBot(report.winnerId);
      const wonWhiteIds = winnerIsBot
        ? []
        : (report.submissions[report.winnerId] ?? []);

      const lobbyId = await resolveLobbyId();
      if (!lobbyId) return;

      await $activityFetch("/api/game/record-round", {
        method: "POST",
        body: {
          lobbyId,
          blackCardId: report.blackCardId,
          playedWhiteIds,
          wonWhiteIds,
          botJudged: report.botJudged,
          // Docs started before gameId existed get card stats only.
          ...(report.gameId
            ? {
                gameId: report.gameId,
                round: report.round,
                submitterIds,
                winnerId: winnerIsBot ? null : report.winnerId,
                gameOver: report.gameOver,
                participantIds: report.participantIds,
              }
            : {}),
        },
      });
    } catch (err) {
      console.warn("[GameEngine] Failed to record round stats:", err);
    }
  };

  /**
   * Records that the judge refused this prompt.
   *
   * Counterpart to reportRoundStats: that one counts prompts that reached a
   * verdict, this one counts prompts that never got played. Fire-and-forget —
   * the swap has already happened in the doc and must not block on it.
   */
  const reportBlackSkip = async (blackCardId: string): Promise<void> => {
    try {
      const lobbyId = await resolveLobbyId();
      if (!lobbyId) return;
      await $activityFetch("/api/game/record-skip", {
        method: "POST",
        body: { lobbyId, blackCardId },
      });
    } catch (err) {
      console.warn("[GameEngine] Failed to record black card skip:", err);
    }
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

      // The Y.Doc only knows the lobby's short join code, not its Postgres
      // row id — but /api/game/draw-cards requires the real lobbyId to verify
      // the caller is a player in that lobby.
      const lobbyId = await resolveLobbyId();
      if (!lobbyId) {
        console.warn(
          "[GameEngine] Cannot replenish deck — no lobby id for the active code",
        );
        return;
      }

      const result = await $activityFetch<{
        success: boolean;
        cardIds: string[];
        cardTexts: Record<string, { text: string; pack: string }>;
      }>("/api/game/draw-cards", {
        method: "POST",
        body: { lobbyId, cardPacks: packs, excludeIds, count },
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

        // Append new IDs to deck. Their texts are deliberately NOT written
        // into the doc: each client resolves the cards it displays through
        // useCardTexts. Merging them here rewrote the entire flat blob on
        // every replenish, growing it until one update crossed Teleportal's
        // ~64KB limit and was silently dropped.
        const deck = safeParseJson<string[]>(c.get("whiteDeck"), []);
        deck.push(...result.cardIds);
        c.set("whiteDeck", JSON.stringify(deck));
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

  /** How long `submitting-complete` is held so the "all cards in" animation
   *  can play before the judging table appears. */
  const SUBMIT_ANIMATION_MS = 500;

  /**
   * The deferred half of the submitting -> judging transition.
   *
   * `playCard` sets `submitting-complete` and hands the real phase change to a
   * timer, and half a second is long enough for the round to change underneath
   * it. Both `skipBlackCard` and `handlePlayerLeave` clear `submissions`
   * without ever seeing `submitting-complete` — the client that ran them was
   * still on `submitting` — so a blind `set("phase", "judging")` when the timer
   * fires drops the table into judging with nothing on it: no submission to
   * pick, and `skipJudge` the only way out.
   *
   * So the decision gets re-derived from whatever the doc holds at fire time
   * rather than from the state that scheduled it. Only `submitting-complete` is
   * ours to move; anything else means another client already resolved the round.
   */
  const settleSubmittingComplete = (): void => {
    // disconnect() nulls the doc ref and every accessor throws after that.
    if (!doc.value) return;

    const state = readGameState();
    if (state.phase !== "submitting-complete") return;

    const eligible = getActivePlayerIds().filter(
      (id) => id !== state.judgeId && !state.skippedPlayers.includes(id),
    );
    const submitted = Object.keys(state.submissions).length;
    const stillComplete = submitted > 0 && submitted >= eligible.length;

    doc.value.transact(() => {
      getGameState().set("phase", stillComplete ? "judging" : "submitting");
    });
  };

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
        // Short delay then transition to judging — let the UI animate.
        // settleSubmittingComplete re-checks the round before committing,
        // because it can change inside this window.
        setTimeout(settleSubmittingComplete, SUBMIT_ANIMATION_MS);
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

    // One reporter per round: the judge — or, when a bot judges, the host,
    // whose client is the one useBots drives selectWinner from. Anyone may
    // technically call selectWinner, so this keeps two clients from both
    // reporting the same round.
    const botJudged = !!state.judgeId && isBot(state.judgeId);
    const isHostUser = getMeta().get("hostUserId") === myId();
    if (myId() === state.judgeId || (botJudged && isHostUser)) {
      const gameOver = finalPhase === "complete";
      void reportRoundStats({
        submissions: state.submissions,
        winnerId,
        blackCardId: state.blackCard?.id || null,
        gameId: (getGameState().get("gameId") as string | null) ?? null,
        round: state.round,
        botJudged,
        gameOver,
        participantIds: gameOver ? Object.keys(state.scores) : [],
      });
    }

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
      const maxPick = safeParseJson<number>(
        lobbyDoc.getSettings().get("maxPick"),
        3,
      );
      // Pick counts only — text is resolved per client, never stored here.
      const draw = drawEligibleBlackCard({
        blackDeck: cards.blackDeck,
        discardBlack: cards.discardBlack,
        blackPicks: readBlackPicks(getCards()),
        maxPick,
      });

      gs.set("blackCard", JSON.stringify(draw.card));
      writeBlackDeck(c, draw.blackDeck);
      c.set("discardBlack", JSON.stringify(draw.discardBlack));

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
      gs.set("blackSkipUsed", JSON.stringify(false));
      gs.set("promptSerial", state.promptSerial + 1);
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

  // ── Skip Black Card ────────────────────────────────────────────────────

  /**
   * Lets the judge swap out a prompt that is not going to produce anything.
   *
   * This is the same round with a different prompt: `round`, `judgeId`,
   * `scores` and `skippedPlayers` are all deliberately left alone. Submitted
   * cards go back to the hands they came from, so nobody loses a card to a
   * prompt they can no longer answer.
   *
   * One skip per round, judge only. `promptSerial` is what tells the animation
   * layer a new prompt is on the table — the phase never changes here, so the
   * phase-edge watcher in GameTable cannot see this on its own.
   */
  const skipBlackCard = (): { success: boolean; reason?: string } => {
    const ydoc = requireDoc();
    const state = readGameState();
    const cards = readCards();

    if (state.phase !== "submitting")
      return { success: false, reason: "Not in submitting phase" };
    if (myId() !== state.judgeId)
      return { success: false, reason: "Only the judge can skip the prompt" };
    if (state.blackSkipUsed)
      return { success: false, reason: "Already skipped a prompt this round" };

    const maxPick = safeParseJson<number>(
      lobbyDoc.getSettings().get("maxPick"),
      3,
    );
    const outgoingId = state.blackCard?.id || "";

    // Draw from the pool WITHOUT the outgoing card: adding it first lets an
    // exhausted deck reshuffle and deal the judge back the very prompt they
    // just rejected. It joins the discard pile after the draw instead, so it
    // stays available for later rounds.
    const draw = drawEligibleBlackCard({
      blackDeck: cards.blackDeck,
      discardBlack: cards.discardBlack,
      blackPicks: readBlackPicks(getCards()),
      maxPick,
    });

    // Nothing to swap to — leave the round exactly as it was.
    if (!draw.card.id)
      return { success: false, reason: "No replacement prompt available" };

    const discardBlack = [...draw.discardBlack];
    // Never let the exhausted-deck sentinel into the discard pile.
    if (outgoingId) discardBlack.push(outgoingId);

    ydoc.transact(() => {
      const gs = getGameState();
      const c = getCards();
      const handsMap = getHands();

      // Give every submitted card back to the hand it came from.
      for (const [pid, cardIds] of Object.entries(state.submissions)) {
        const hand = safeParseJson<CardId[]>(handsMap.get(pid), []);
        hand.push(...cardIds);
        handsMap.set(pid, JSON.stringify(hand));
      }

      gs.set("submissions", "{}");
      gs.set("revealedCards", "{}");
      gs.set("readAloudText", "");

      gs.set("blackCard", JSON.stringify(draw.card));
      writeBlackDeck(c, draw.blackDeck);
      c.set("discardBlack", JSON.stringify(discardBlack));

      gs.set("blackSkipUsed", JSON.stringify(true));
      gs.set("promptSerial", state.promptSerial + 1);
    });

    if (outgoingId) void reportBlackSkip(outgoingId);

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

    // Async: keep the players table's playerType in step with the Y.Doc.
    void mirrorConversionToServer(playerId);

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
      gs.set("gameId", null);

      getMeta().set("status", "waiting");

      // Clear cards and hands
      const c = getCards();
      c.set("whiteDeck", "[]");
      writeBlackDeck(c, []);
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
        const blackPicks = readBlackPicks(c);

        // Find next eligible black card (pick <= maxPick).
        // NOTE: this is an older, DIVERGED copy of the draw loop that
        // `drawEligibleBlackCard` (used by nextRound and skipBlackCard) owns.
        // It differs in two observable ways: it empties the reshuffled discard
        // pile in place (`discardBlack.length = 0`), and on exhaustion it sets
        // `blackCard` to null rather than the
        // `{ id: "", text: "No eligible cards remain", pick: 1 }` sentinel the
        // shared helper returns. Deduping it is a real change of behaviour and
        // is deliberately out of scope here — a future dedup task should start
        // from those two differences.
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
          if ((blackPicks[candidateId] ?? 1) <= maxPick) {
            nextBlackId = candidateId;
          } else {
            discardBlack.push(candidateId);
          }
        }

        if (nextBlackId) {
          gs.set(
            "blackCard",
            JSON.stringify({
              id: nextBlackId,
              pick: blackPicks[nextBlackId] ?? 1,
            }),
          );
        } else {
          gs.set("blackCard", null);
        }

        writeBlackDeck(c, blackDeck);
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
        gs.set("readAloudText", "");
        // A fresh prompt is on the table, so the animation layer has to be
        // told. This used to ride on the judging -> submitting phase edge, but
        // that fallback switches off as soon as the doc carries a serial, so
        // without the bump NEITHER GameTable watcher fires and the rest of the
        // round loses its fly-ins. The new prompt also returns the judge's one
        // skip for the round.
        gs.set("promptSerial", state.promptSerial + 1);
        gs.set("blackSkipUsed", JSON.stringify(false));
        if (state.phase === "roundEnd") {
          // Round `state.round` was already reported (selectWinner fires the
          // report on entering roundEnd), so this fresh prompt has to be the
          // next round or its own report would be deduped by the ledger and
          // dropped entirely. submitting/judging haven't been reported yet,
          // so they must stay on the same round number.
          gs.set("round", state.round + 1);
        }
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

    if (state.judgeId === pid)
      return { success: false, reason: "Judge cannot draw cards" };

    // A player who has already submitted is owed those cards back if the judge
    // skips the prompt; letting them draw to full now would inflate the hand
    // past cardsPerPlayer permanently, since nextRound only tops up a deficit.
    if (state.submissions[pid])
      return { success: false, reason: "Already submitted this round" };

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
    skipBlackCard,
    setReadAloud,
    convertToPlayer,
    resetGame,
    markReturnedToLobby,
    handlePlayerLeave,
    replenishWhiteDeck,
    drawCards,
  };
}
