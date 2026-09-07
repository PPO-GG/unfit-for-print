/**
 * Rates over the card counters the engine writes.
 *
 * The only real rule here is the small-sample guard: a card played twice and
 * won once is not a 50% card, and sorting by an unguarded rate returns noise
 * at the top — worse than offering no sort at all. Below the threshold a card
 * has no rate, and callers must render that as "not enough plays" rather than
 * as zero.
 */
import type { AdminCard } from "~/composables/useAdminCardList";

export const MIN_PLAYS_FOR_RATE = 20;

export type RateKind = "win" | "skip";

export function cardRate(card: AdminCard): { kind: RateKind; value: number | null } {
  const kind: RateKind = card.type === "black" ? "skip" : "win";
  const played = card.timesPlayed ?? 0;
  if (played < MIN_PLAYS_FOR_RATE) return { kind, value: null };
  const hits = (kind === "skip" ? card.timesSkipped : card.timesWon) ?? 0;
  return { kind, value: hits / played };
}

export function packAverage(cards: AdminCard[], kind: RateKind): number | null {
  const rates: number[] = [];
  for (const card of cards) {
    const r = cardRate(card);
    if (r.kind === kind && r.value !== null) rates.push(r.value);
  }
  if (!rates.length) return null;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}
