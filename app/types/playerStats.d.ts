/** A player's own gameplay counters, as returned by GET /api/stats/me. */
export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  roundsPlayed: number;
  roundsWon: number;
  roundsJudged: number;
}
