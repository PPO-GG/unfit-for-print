/**
 * Rounds won as a whole percentage of rounds played, or null before any have
 * been played — so the profile shows "—" rather than a misleading 0%.
 */
export function winRatePercent(
  roundsWon: number,
  roundsPlayed: number,
): number | null {
  if (roundsPlayed <= 0) return null;
  return Math.round((roundsWon / roundsPlayed) * 100);
}
