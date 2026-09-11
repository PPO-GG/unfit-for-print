// server/api/stats/me.get.ts
// The caller's own gameplay counters. Takes no user id on purpose: there is no
// way to ask this route for anyone else's stats.

import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { userStats } from "~~/server/db/schema";
import { requireNonGuest } from "~~/server/utils/session";
import type { PlayerStats } from "~/types/playerStats";

const NO_STATS: PlayerStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  roundsPlayed: 0,
  roundsWon: 0,
  roundsJudged: 0,
};

export default defineEventHandler(async (event): Promise<PlayerStats> => {
  const userId = await requireNonGuest(event);

  const [row] = await useDb()
    .select({
      gamesPlayed: userStats.gamesPlayed,
      gamesWon: userStats.gamesWon,
      roundsPlayed: userStats.roundsPlayed,
      roundsWon: userStats.roundsWon,
      roundsJudged: userStats.roundsJudged,
    })
    .from(userStats)
    .where(eq(userStats.userId, userId))
    .limit(1);

  // No row until the first counted round; that is "nothing yet", not a 404.
  return row ?? NO_STATS;
});
