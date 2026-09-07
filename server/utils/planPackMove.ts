/**
 * Decides what happens to a pack's auxiliary rows (card_packs,
 * default_card_packs) when its cards move somewhere else.
 *
 * Two rules, and they compose to cover every case:
 *
 *   1. Auxiliary rows travel only when the move *empties* the source pack.
 *      Moving only a pack's white cards while it keeps black cards is a
 *      split, not a rename — the pack still exists, so its metadata stays.
 *   2. On a collision, the target always wins and merging never grants
 *      anything. "Collision" means *anything* was at the target key before
 *      the move — a card in either table, a card_packs row, or a
 *      default_card_packs row. Both directions matter: a metadata row with
 *      zero cards still counts (so the target's description survives), and
 *      cards with no row still count (so whether default status transfers
 *      does not hinge on whether the target happened to have metadata).
 *
 * Working out `targetExisted` is the caller's job, and it must be done
 * before the card update — afterwards the target trivially has cards.
 */
export type PackMoveAuxAction = "move" | "drop" | "leave";

export interface PackMovePlan {
  aux: PackMoveAuxAction;
}

export function planPackMove(input: {
  sourceRetainsCards: boolean;
  targetExisted: boolean;
}): PackMovePlan {
  if (input.sourceRetainsCards) return { aux: "leave" };
  return { aux: input.targetExisted ? "drop" : "move" };
}
