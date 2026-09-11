/**
 * Black cards whose pick count disagrees with the blanks in their text.
 *
 * Pure and free of Vue/Nuxt imports so the admin scan page and the report
 * viewer share one copy of the rule.
 *
 * The rule only speaks up at two or more blanks. Zero blanks is how
 * "Make a haiku." legitimately asks for pick 3, and a single blank is
 * ordinary pick-1 prompt text — neither tells us the pick is wrong.
 */

/** The game never deals more than this many cards per prompt (see game/start.post.ts). */
export const MAX_PICK = 3;

/** Each run of underscores is one blank — `___s` included. */
export function countBlanks(text: string | null | undefined): number {
  return text?.match(/_+/g)?.length ?? 0;
}

/** The pick a card's blanks imply, or null when the blanks don't decide it. */
export function suggestedPick(text: string | null | undefined): number | null {
  const blanks = countBlanks(text);
  return blanks >= 2 ? Math.min(blanks, MAX_PICK) : null;
}

export interface PickMismatch<T> {
  card: T;
  blanks: number;
  suggested: number;
}

export function findPickMismatches<T extends { text?: string | null; pick?: number | null }>(
  cards: T[],
): PickMismatch<T>[] {
  const mismatches: PickMismatch<T>[] = [];
  for (const card of cards) {
    const suggested = suggestedPick(card.text);
    if (suggested !== null && suggested !== (card.pick ?? 1)) {
      mismatches.push({ card, blanks: countBlanks(card.text), suggested });
    }
  }
  return mismatches;
}
