// server/api/game/record-round.post.ts
// Records per-card play statistics for one completed round.
//
// `white_cards.times_played` / `times_won` and `black_cards.times_played` have
// existed since the initial migration but nothing ever incremented them: the
// game runs client-side in the Y.Doc, so no server route was in a position to
// know a round had finished. This is that route.
//
// Called once per round by the judge's client after selectWinner commits (see
// reportRoundStats in useYjsGameEngine). Fire-and-forget — the round has
// already happened and must never block on this.
//
// Deliberately not idempotent: a client that double-fires double-counts. A
// round-key dedupe table costs more than that error is worth at this precision.

import { inArray, sql } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { blackCards, whiteCards } from "~~/server/db/schema";
import { isCardId, cleanCardIds } from "~~/server/utils/cardIds";
import { requirePlayerInLobby } from "~~/server/utils/session";

/** A round is bounded by players x pick; anything past this is not a real game. */
const MAX_CARDS_PER_ROUND = 100;

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    lobbyId?: string;
    blackCardId?: string | null;
    playedWhiteIds?: string[];
    wonWhiteIds?: string[];
  }>(event);

  const { lobbyId, blackCardId } = body ?? {};

  if (!lobbyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  }

  for (const key of ["playedWhiteIds", "wonWhiteIds"] as const) {
    if (body?.[key] !== undefined && !Array.isArray(body[key])) {
      throw createError({
        statusCode: 400,
        statusMessage: `${key} must be an array`,
      });
    }
  }

  const played = cleanCardIds(body?.playedWhiteIds);
  const won = cleanCardIds(body?.wonWhiteIds);

  if (
    played.length > MAX_CARDS_PER_ROUND ||
    won.length > MAX_CARDS_PER_ROUND
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: `Too many cards in one round (max ${MAX_CARDS_PER_ROUND})`,
    });
  }

  await requirePlayerInLobby(event, lobbyId);
  const db = useDb();

  // Winning cards were also played, so they land in both lists and
  // times_won / times_played reads as a true win rate.
  if (played.length > 0) {
    await db
      .update(whiteCards)
      .set({ timesPlayed: sql`${whiteCards.timesPlayed} + 1` })
      .where(inArray(whiteCards.id, played));
  }

  if (won.length > 0) {
    await db
      .update(whiteCards)
      .set({ timesWon: sql`${whiteCards.timesWon} + 1` })
      .where(inArray(whiteCards.id, won));
  }

  if (isCardId(blackCardId)) {
    await db
      .update(blackCards)
      .set({ timesPlayed: sql`${blackCards.timesPlayed} + 1` })
      .where(inArray(blackCards.id, [blackCardId]));
  }

  return { success: true };
});
