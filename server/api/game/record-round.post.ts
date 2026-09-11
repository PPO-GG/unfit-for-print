// server/api/game/record-round.post.ts
// Records statistics for one completed round: per-card play counts, and —
// when the body carries a gameId — per-player counts in user_stats.
//
// `white_cards.times_played` / `times_won` and `black_cards.times_played` have
// existed since the initial migration but nothing ever incremented them: the
// game runs client-side in the Y.Doc, so no server route was in a position to
// know a round had finished. This is that route.
//
// Called once per round after selectWinner commits — by the judge's client, or
// by the host's when a bot judges (see reportRoundStats in useYjsGameEngine).
// Fire-and-forget: the round has already happened and must never block on this.
//
// Idempotent when the body carries `gameId` + `round`: that pair is claimed in
// stat_rounds first, and a replay changes nothing, card counters included. A
// body without them (a doc started before gameId existed, or a cached old
// client) still double-counts on a double-fire, as it always has.

import { and, eq, inArray, sql } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import {
  blackCards,
  players,
  statRounds,
  userStats,
  users,
  whiteCards,
} from "~~/server/db/schema";
import { isCardId, cleanCardIds } from "~~/server/utils/cardIds";
import { planStatDeltas } from "~~/server/utils/playerStats";
import { requirePlayerInLobby } from "~~/server/utils/session";

/** A round is bounded by players x pick; anything past this is not a real game. */
const MAX_CARDS_PER_ROUND = 100;
/** Same bound for the player-id lists; no real lobby comes near it. */
const MAX_PLAYERS_PER_ROUND = 100;

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    lobbyId?: string;
    blackCardId?: string | null;
    playedWhiteIds?: string[];
    wonWhiteIds?: string[];
    gameId?: string;
    round?: number;
    submitterIds?: string[];
    winnerId?: string | null;
    botJudged?: boolean;
    gameOver?: boolean;
    participantIds?: string[];
  }>(event);

  const { lobbyId, blackCardId } = body ?? {};

  if (!lobbyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  }

  for (const key of [
    "playedWhiteIds",
    "wonWhiteIds",
    "submitterIds",
    "participantIds",
  ] as const) {
    if (body?.[key] !== undefined && !Array.isArray(body[key])) {
      throw createError({
        statusCode: 400,
        statusMessage: `${key} must be an array`,
      });
    }
  }

  const played = cleanCardIds(body?.playedWhiteIds);
  const won = cleanCardIds(body?.wonWhiteIds);
  // User ids are uuids too, so the same untrusted-array filter applies.
  const submitterIds = cleanCardIds(body?.submitterIds);
  const participantIds = cleanCardIds(body?.participantIds);

  if (
    played.length > MAX_CARDS_PER_ROUND ||
    won.length > MAX_CARDS_PER_ROUND
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: `Too many cards in one round (max ${MAX_CARDS_PER_ROUND})`,
    });
  }

  if (
    submitterIds.length > MAX_PLAYERS_PER_ROUND ||
    participantIds.length > MAX_PLAYERS_PER_ROUND
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: `Too many players in one round (max ${MAX_PLAYERS_PER_ROUND})`,
    });
  }

  // Read into locals first: a type guard on `body?.x` does not narrow a
  // later `body.x` read.
  const rawWinnerId = body?.winnerId;
  const winnerId = isCardId(rawWinnerId) ? rawWinnerId : null;
  if (winnerId && !submitterIds.includes(winnerId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "winnerId must be one of submitterIds",
    });
  }

  const botJudged = body?.botJudged === true;
  const gameOver = body?.gameOver === true;
  const rawGameId = body?.gameId;
  const gameId = isCardId(rawGameId) ? rawGameId : null;
  const rawRound = body?.round;
  const round =
    typeof rawRound === "number" && Number.isInteger(rawRound) && rawRound > 0
      ? rawRound
      : null;
  const roundKey = gameId !== null && round !== null ? { gameId, round } : null;

  const callerId = await requirePlayerInLobby(event, lobbyId);
  const db = useDb();

  const duplicate = await db.transaction(async (tx) => {
    if (roundKey) {
      const claimed = await tx
        .insert(statRounds)
        .values(roundKey)
        .onConflictDoNothing()
        .returning({ round: statRounds.round });
      if (claimed.length === 0) return true;
    }

    // Card stats count what humans pick, so a bot's verdict is left out —
    // as it always was, back when bot-judged rounds were never reported.
    if (!botJudged) {
      // Winning cards were also played, so they land in both lists and
      // times_won / times_played reads as a true win rate.
      if (played.length > 0) {
        await tx
          .update(whiteCards)
          .set({ timesPlayed: sql`${whiteCards.timesPlayed} + 1` })
          .where(inArray(whiteCards.id, played));
      }

      if (won.length > 0) {
        await tx
          .update(whiteCards)
          .set({ timesWon: sql`${whiteCards.timesWon} + 1` })
          .where(inArray(whiteCards.id, won));
      }

      if (isCardId(blackCardId)) {
        await tx
          .update(blackCards)
          .set({ timesPlayed: sql`${blackCards.timesPlayed} + 1` })
          .where(inArray(blackCards.id, [blackCardId]));
      }
    }

    if (roundKey) {
      const candidates = [
        ...new Set([...submitterIds, ...participantIds, callerId]),
      ];
      // Guests, bots, spectators, and anyone who already left (their players
      // row is gone) are simply not returned, and so never credited.
      const eligibleRows = await tx
        .select({ userId: players.userId })
        .from(players)
        .innerJoin(users, eq(users.id, players.userId))
        .where(
          and(
            eq(players.lobbyId, lobbyId),
            eq(players.playerType, "player"),
            eq(users.isGuest, false),
            inArray(players.userId, candidates),
          ),
        );

      const deltas = planStatDeltas(
        { callerId, submitterIds, winnerId, botJudged, gameOver, participantIds },
        new Set(eligibleRows.map((r) => r.userId)),
      );

      if (deltas.size > 0) {
        await tx
          .insert(userStats)
          .values([...deltas].map(([userId, d]) => ({ userId, ...d })))
          .onConflictDoUpdate({
            target: userStats.userId,
            // `excluded` is the row this insert proposed for that user, so
            // each user gains exactly their own delta.
            set: {
              gamesPlayed: sql`${userStats.gamesPlayed} + excluded.games_played`,
              gamesWon: sql`${userStats.gamesWon} + excluded.games_won`,
              roundsPlayed: sql`${userStats.roundsPlayed} + excluded.rounds_played`,
              roundsWon: sql`${userStats.roundsWon} + excluded.rounds_won`,
              roundsJudged: sql`${userStats.roundsJudged} + excluded.rounds_judged`,
              updatedAt: sql`now()`,
            },
          });
      }
    }

    return false;
  });

  return duplicate ? { success: true, duplicate: true } : { success: true };
});
