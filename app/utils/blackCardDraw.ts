/**
 * Picks the next eligible black card.
 *
 * Extracted from useYjsGameEngine.nextRound so that skipBlackCard can reuse it
 * byte-identically — two copies of a loop containing a reshuffle and a sentinel
 * would drift. Pure and Vue-free so it can be unit-tested directly.
 *
 * Must stay synchronous: callers run it inside doc.transact(), which is also
 * why pick counts live in the Y.Doc at all.
 */
import type { CardId } from "~/types/game";
import { shuffle } from "~/utils/shuffle";

export interface BlackDrawInput {
  blackDeck: CardId[];
  discardBlack: CardId[];
  blackPicks: Record<CardId, number>;
  maxPick: number;
  shuffleFn?: <T>(array: T[]) => T[];
}

export interface BlackDrawResult {
  card: { id: CardId; pick: number } | { id: ""; text: string; pick: 1 };
  blackDeck: CardId[];
  discardBlack: CardId[];
}

export function drawEligibleBlackCard(input: BlackDrawInput): BlackDrawResult {
  const mix = input.shuffleFn ?? shuffle;
  let blackDeck = [...input.blackDeck];
  let discardBlack = [...input.discardBlack];

  let newBlackCardId: CardId | null = null;
  let reshuffled = false;

  while (!newBlackCardId) {
    if (blackDeck.length === 0) {
      if (reshuffled) break; // Avoid infinite loop
      blackDeck = mix([...discardBlack]);
      discardBlack = [];
      reshuffled = true;
      if (blackDeck.length === 0) break;
    }
    const candidateId = blackDeck.pop()!;
    if ((input.blackPicks[candidateId] ?? 1) <= input.maxPick) {
      newBlackCardId = candidateId;
    } else {
      discardBlack.push(candidateId);
    }
  }

  // The exhausted-deck sentinel keeps its text: there is no card id to resolve
  // one from, and the reactive overlay prefers an embedded text when present.
  const card = newBlackCardId
    ? { id: newBlackCardId, pick: input.blackPicks[newBlackCardId] ?? 1 }
    : ({ id: "", text: "No eligible cards remain", pick: 1 } as const);

  return { card, blackDeck, discardBlack };
}
