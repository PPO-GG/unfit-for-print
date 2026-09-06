/**
 * Picks which card in a duplicate cluster is the one worth keeping.
 *
 * Pure and Vue-free so it can be unit-tested directly. Only signals the schema
 * actually maintains are used: `times_played` / `times_won` exist as columns
 * but nothing ever increments them — scoring happens client-side in the Y.Doc,
 * so no server route is in a position to write them, and they are always 0.
 */

import type { ScannableCard } from "./duplicateScan";

export interface KeeperOptions {
  /** Packs enabled by default for new lobbies, from /api/admin/cards/default-packs. */
  defaultPacks: string[];
}

export interface KeeperReason {
  label: string;
  weight: number;
}

/**
 * Ordered strongest signal first — the list doubles as the explanation shown
 * next to the suggested card, so keep the labels readable.
 */
const SIGNALS: {
  label: string;
  weight: number;
  test: (card: ScannableCard, options: KeeperOptions) => boolean;
}[] = [
  {
    label: "Currently enabled",
    weight: 1000,
    // A disabled card is one an admin already ruled out; being in a popular
    // pack shouldn't drag it back into rotation.
    test: (card) => card.active !== false,
  },
  {
    label: "In a default pack",
    weight: 100,
    test: (card, { defaultPacks }) =>
      !!card.pack && defaultPacks.includes(card.pack),
  },
  {
    label: "Has an image",
    weight: 10,
    test: (card) => !!card.imageKey,
  },
  {
    label: "Has an attachment",
    weight: 10,
    test: (card) => !!card.attachment,
  },
];

/** Signals that fired for a card, for showing why it was suggested. */
export const keeperReasons = (
  card: ScannableCard,
  options: KeeperOptions,
): KeeperReason[] =>
  SIGNALS.filter((signal) => signal.test(card, options)).map(
    ({ label, weight }) => ({ label, weight }),
  );

const scoreCard = (card: ScannableCard, options: KeeperOptions): number =>
  SIGNALS.reduce(
    (total, signal) => (signal.test(card, options) ? total + signal.weight : total),
    0,
  );

/**
 * The best card to keep out of a cluster.
 *
 * Ties fall through to the longer text — usually the one with its punctuation
 * intact — and finally to the id, so the same cluster always suggests the same
 * card no matter what order the scan happened to produce it in.
 */
export const suggestKeeper = <T extends ScannableCard>(
  cards: T[],
  options: KeeperOptions,
): T => {
  // Copy before sorting: callers pass the cluster's own array.
  return [...cards].sort((a, b) => {
    const byScore = scoreCard(b, options) - scoreCard(a, options);
    if (byScore !== 0) return byScore;

    const byLength = (b.text?.length ?? 0) - (a.text?.length ?? 0);
    if (byLength !== 0) return byLength;

    return a.id.localeCompare(b.id);
  })[0]!;
};
