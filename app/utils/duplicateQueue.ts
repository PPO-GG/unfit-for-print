/**
 * Review-queue bookkeeping for the duplicate scanner.
 *
 * The first version tracked position with an index into an array it also
 * removed entries from, and never recorded which groups had been skipped.
 * That produced a dead end: skipping was disabled on the final index, and
 * resolving that group shrank the array so the index clamped backwards onto a
 * group the admin had already skipped, with no way forward.
 *
 * Here the cluster list stays fixed for the life of a scan and "resolved" is
 * tracked separately by a stable key, so navigation can always find the next
 * group that still needs a decision.
 */

import type { DuplicateCluster, ScannableCard } from "./duplicateScan";

type AnyCluster = DuplicateCluster<any>;

/** Identity for a group that survives card pruning and reordering. */
export const clusterKey = (cluster: AnyCluster): string =>
  cluster.cards
    .map((card: ScannableCard) => card.id)
    .slice()
    .sort()
    .join("|");

/**
 * A group still needs review if it hasn't been resolved and still has at least
 * two cards — one card left is not a duplicate of anything.
 */
export const isPending = (
  cluster: AnyCluster,
  resolvedKeys: Set<string>,
): boolean => cluster.cards.length > 1 && !resolvedKeys.has(clusterKey(cluster));

export const pendingCount = (
  clusters: AnyCluster[],
  resolvedKeys: Set<string>,
): number =>
  clusters.reduce(
    (total, cluster) => (isPending(cluster, resolvedKeys) ? total + 1 : total),
    0,
  );

/**
 * Index of the next group needing review, wrapping around the end of the list.
 *
 * Returns -1 when no *other* group is pending, which is what tells the caller
 * the queue is finished rather than looping the reviewer back onto the group
 * they are already looking at.
 */
export const nextPendingIndex = (
  clusters: AnyCluster[],
  resolvedKeys: Set<string>,
  from: number,
  direction: 1 | -1,
): number => {
  const n = clusters.length;
  if (n === 0) return -1;

  for (let step = 1; step <= n; step++) {
    // Double modulo so backwards walks (and an out-of-range `from`) stay positive.
    const index = (((from + direction * step) % n) + n) % n;
    if (index === from) continue;
    if (isPending(clusters[index]!, resolvedKeys)) return index;
  }

  return -1;
};

/**
 * Remove newly-disabled cards from every group, leaving the list itself the
 * same length so indexes stay meaningful. Groups that fall to a single card
 * stop being pending on their own via `isPending`.
 */
export const pruneDisabledCards = (
  clusters: AnyCluster[],
  disabledIds: Set<string>,
): AnyCluster[] =>
  clusters.map((cluster) => {
    if (!cluster.cards.some((card: ScannableCard) => disabledIds.has(card.id))) {
      return cluster;
    }
    return {
      ...cluster,
      cards: cluster.cards.filter(
        (card: ScannableCard) => !disabledIds.has(card.id),
      ),
      pairs: cluster.pairs.filter(
        (pair) => !disabledIds.has(pair.a) && !disabledIds.has(pair.b),
      ),
    };
  });

/**
 * Cards in a group that are NOT marked for disabling.
 *
 * Keeping several and dropping one is a normal outcome: cards can be similar
 * enough to flag while still being different enough to both earn their place.
 */
export const keptCards = (
  cluster: AnyCluster,
  disableIds: Set<string>,
): ScannableCard[] =>
  cluster.cards.filter((card: ScannableCard) => !disableIds.has(card.id));

/**
 * The selection a group opens with: keep the suggested card, drop the rest.
 * That makes the common "one real duplicate" case a single click, while still
 * letting every card be toggled individually.
 */
export const defaultDisableSelection = (
  cluster: AnyCluster,
  keeperId: string | null,
): Set<string> => {
  if (cluster.cards.length < 2) return new Set();
  return new Set(
    cluster.cards
      .filter((card: ScannableCard) => card.id !== keeperId)
      .map((card: ScannableCard) => card.id),
  );
};

/**
 * A decision is applicable as long as at least one card survives. Disabling
 * every copy would pull the card out of the game altogether, which is never
 * what resolving a duplicate means — keeping all of them, on the other hand,
 * is the legitimate "similar but both fine" outcome.
 */
export const canApplyDecision = (
  cluster: AnyCluster,
  disableIds: Set<string>,
): boolean => keptCards(cluster, disableIds).length > 0;
