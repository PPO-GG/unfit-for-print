// Turns one reported round into per-user counter increments for user_stats.
//
// Pure and DB-free so the crediting rules can be tested without Postgres.
// record-round.post.ts supplies `eligible` from a single players ⨝ users query
// (non-guest `player` rows in that lobby); everyone else is dropped here, which
// is how guests, bots, spectators, and players who already left go uncounted.

export interface StatDelta {
  gamesPlayed: number;
  gamesWon: number;
  roundsPlayed: number;
  roundsWon: number;
  roundsJudged: number;
}

export interface RoundReport {
  /** The authenticated reporter: the judge, or the host when a bot judged. */
  callerId: string;
  submitterIds: string[];
  /** Null when a bot won the round. */
  winnerId: string | null;
  botJudged: boolean;
  gameOver: boolean;
  /** Everyone in the game's scores; only meaningful when gameOver. */
  participantIds: string[];
}

const emptyDelta = (): StatDelta => ({
  gamesPlayed: 0,
  gamesWon: 0,
  roundsPlayed: 0,
  roundsWon: 0,
  roundsJudged: 0,
});

export function planStatDeltas(
  report: RoundReport,
  eligible: ReadonlySet<string>,
): Map<string, StatDelta> {
  const deltas = new Map<string, StatDelta>();

  const bump = (userId: string, key: keyof StatDelta) => {
    if (!eligible.has(userId)) return;
    const delta = deltas.get(userId) ?? emptyDelta();
    delta[key] += 1;
    deltas.set(userId, delta);
  };

  for (const id of new Set(report.submitterIds)) bump(id, "roundsPlayed");
  if (report.winnerId) bump(report.winnerId, "roundsWon");
  // The caller of a bot-judged round is the host relaying for the bot.
  if (!report.botJudged) bump(report.callerId, "roundsJudged");

  if (report.gameOver) {
    // The winner is always a participant in practice; the union just makes
    // sure a malformed participant list cannot yield a win with no game.
    const players = new Set(report.participantIds);
    if (report.winnerId) players.add(report.winnerId);
    for (const id of players) bump(id, "gamesPlayed");
    if (report.winnerId) bump(report.winnerId, "gamesWon");
  }

  return deltas;
}
