// server/api/game/record-skip.post.ts
// Records that a judge refused a black card and swapped it out.
//
// Counterpart to record-round: that route counts prompts that reached a
// verdict, this one counts prompts that never got played. The two are disjoint
// by construction — a skipped round never reaches selectWinner — so
// times_skipped / (times_played + times_skipped) is a true skip rate.
//
// Fired fire-and-forget by the judge's client after skipBlackCard commits.
// Deliberately not idempotent, for the same reason as record-round: a double
// fire double-counts, and a dedupe table costs more than that error is worth.

import { eq, sql } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { blackCards } from "~~/server/db/schema";
import { isCardId } from "~~/server/utils/cardIds";
import { requirePlayerInLobby } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { lobbyId, blackCardId } = await readBody<{
    lobbyId?: string;
    blackCardId?: string | null;
  }>(event);

  if (!lobbyId) {
    throw createError({ statusCode: 400, statusMessage: "lobbyId is required" });
  }

  await requirePlayerInLobby(event, lobbyId);

  if (!isCardId(blackCardId)) return { success: true };

  await useDb()
    .update(blackCards)
    .set({ timesSkipped: sql`${blackCards.timesSkipped} + 1` })
    .where(eq(blackCards.id, blackCardId));

  return { success: true };
});
