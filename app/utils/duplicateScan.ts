/**
 * Near-duplicate card detection.
 *
 * Pure, synchronous, and free of Vue/Nuxt imports so it can run unchanged
 * inside the scan Web Worker and be unit-tested directly. The worker owns
 * the message plumbing; everything that decides what counts as a duplicate
 * lives here, so there is exactly one copy of the rules.
 */

export interface ScannableCard {
  id: string;
  text?: string | null;
  pack?: string | null;
  active?: boolean;
  pick?: number | null;
  [key: string]: unknown;
}

export interface DuplicatePair {
  a: string;
  b: string;
  similarity: number;
}

export interface DuplicateCluster<T extends ScannableCard = ScannableCard> {
  cards: T[];
  pairs: DuplicatePair[];
  /** Strongest similarity between any two members — how alike the cluster is. */
  topSimilarity: number;
}

export interface ScanOptions {
  threshold: number;
  type: "white" | "black" | string;
  /** Only pair cards that share a pack, for cleaning one pack at a time. */
  samePackOnly?: boolean;
  onProgress?: (progress: number) => void;
}

/** Curly quotes and dashes that mean the same thing as their ASCII twins. */
const PUNCTUATION_ALIASES: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "–": "-",
  "—": "-",
  "−": "-",
  "…": "...",
  " ": " ",
};

/**
 * Reduce card text to the form the comparison actually cares about.
 *
 * Two cards that differ only in casing, curly-vs-straight punctuation, blank
 * length ("What is ____?" vs "What is __?"), or trailing periods are the same
 * card as far as an admin is concerned, so none of that should cost similarity.
 * Blanks collapse to a single "_" kept as its own word, so a blank never fuses
 * with the word beside it and invents bigrams that aren't there.
 */
export const normalizeCardText = (text?: string | null): string => {
  if (!text) return "";

  let out = "";
  for (const char of text) out += PUNCTUATION_ALIASES[char] ?? char;

  return out
    .toLowerCase()
    .replace(/_+/g, " _ ")
    .replace(/[^a-z0-9_\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

/** Bigram count of a string once whitespace is removed. */
export const bigramCount = (text: string): number =>
  Math.max(0, text.replace(/\s+/g, "").length - 1);

/**
 * Sørensen–Dice coefficient over character bigrams, ignoring whitespace.
 *
 * Matches the behaviour of the `string-similarity` package the admin UI used
 * before, so existing threshold settings keep meaning roughly what they meant.
 */
export const diceSimilarity = (first: string, second: string): number => {
  const a = first.replace(/\s+/g, "");
  const b = second.replace(/\s+/g, "");

  if (a === b) return a.length > 0 ? 1 : 0;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.substring(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.substring(i, i + 2);
    const count = bigrams.get(bigram) ?? 0;
    if (count > 0) {
      bigrams.set(bigram, count - 1);
      intersection++;
    }
  }

  return (2 * intersection) / (a.length + b.length - 2);
};

/**
 * The highest Dice score two strings with these bigram counts could reach.
 *
 * The intersection can never exceed the smaller bigram count, so the score is
 * capped at 2·min/(min+max). That makes this a *sound* bound: no pair it rules
 * out could have met the threshold. The old scan instead skipped pairs whose
 * first two characters didn't overlap, which is not sound at all — it quietly
 * dropped real duplicates like "The Amish" / "Amish people".
 */
export const maxPossibleDice = (
  firstBigrams: number,
  secondBigrams: number,
): number => {
  if (firstBigrams <= 0 || secondBigrams <= 0) return 0;
  const min = Math.min(firstBigrams, secondBigrams);
  const max = Math.max(firstBigrams, secondBigrams);
  return (2 * min) / (min + max);
};

interface PreparedCard {
  index: number;
  norm: string;
  bigrams: number;
  pick: number | null;
  pack: string | null;
}

/** Union-find, so N mutually-similar cards become one group instead of N² pairs. */
const makeUnionFind = (size: number) => {
  const parent = Array.from({ length: size }, (_, i) => i);

  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root]!;
    // Path compression, so repeated lookups over a large cluster stay flat.
    let walk = i;
    while (parent[walk] !== root) {
      const next = parent[walk]!;
      parent[walk] = root;
      walk = next;
    }
    return root;
  };

  return {
    find,
    union: (a: number, b: number) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parent[rootB] = rootA;
    },
  };
};

/**
 * Find groups of near-duplicate cards at or above `threshold`.
 *
 * Cards are sorted by length so the inner loop can `break` the moment the
 * length bound rules out every remaining candidate — everything after it is
 * only longer, so nothing reachable is skipped. That is both exact and faster
 * than the per-pair `continue` it replaces.
 *
 * Black cards only compare against others with the same `pick`: two prompts
 * needing different numbers of answers aren't interchangeable, whatever their
 * wording. `pick` is ignored for white cards, which don't have one.
 *
 * With `samePackOnly`, cards only pair against others in the same pack — the
 * same skip-the-pair mechanism as `pick`. Cards without a pack form their own
 * bucket rather than matching everything.
 */
export const findDuplicateClusters = <T extends ScannableCard>(
  cards: T[],
  { threshold, type, samePackOnly = false, onProgress }: ScanOptions,
): DuplicateCluster<T>[] => {
  const prepared: PreparedCard[] = [];
  cards.forEach((card, index) => {
    const norm = normalizeCardText(card.text);
    const bigrams = bigramCount(norm);
    // A card with no bigrams can only ever score 0 — nothing to compare.
    if (bigrams > 0) {
      prepared.push({
        index,
        norm,
        bigrams,
        pick: typeof card.pick === "number" ? card.pick : null,
        pack: typeof card.pack === "string" ? card.pack : null,
      });
    }
  });

  prepared.sort((a, b) => a.bigrams - b.bigrams || a.index - b.index);

  const n = prepared.length;
  const comparePick = type === "black";
  const uf = makeUnionFind(cards.length);
  const pairs: DuplicatePair[] = [];

  const report = (progress: number) => onProgress?.(progress);
  let lastReported = -1;

  for (let i = 0; i < n; i++) {
    const first = prepared[i]!;

    for (let j = i + 1; j < n; j++) {
      const second = prepared[j]!;

      // Sorted ascending by bigram count, so once the bound fails it fails for
      // every remaining j too.
      if (maxPossibleDice(first.bigrams, second.bigrams) < threshold) break;

      if (comparePick && first.pick !== second.pick) continue;
      if (samePackOnly && first.pack !== second.pack) continue;

      const similarity = diceSimilarity(first.norm, second.norm);
      if (similarity < threshold) continue;

      uf.union(first.index, second.index);
      pairs.push({
        a: cards[first.index]!.id,
        b: cards[second.index]!.id,
        similarity,
      });
    }

    // Roughly every 1% of the outer walk, to avoid flooding the main thread.
    const pct = n > 0 ? Math.floor(((i + 1) / n) * 100) : 100;
    if (pct !== lastReported) {
      lastReported = pct;
      report(pct / 100);
    }
  }

  if (lastReported !== 100) report(1);

  if (pairs.length === 0) return [];

  const indexById = new Map(cards.map((card, index) => [card.id, index]));

  // Bucket every card by its cluster root; anything still alone isn't a duplicate.
  const groups = new Map<number, DuplicateCluster<T>>();
  cards.forEach((card, index) => {
    const root = uf.find(index);
    const cluster = groups.get(root);
    if (cluster) cluster.cards.push(card);
    else groups.set(root, { cards: [card], pairs: [], topSimilarity: 0 });
  });

  for (const pair of pairs) {
    const cluster = groups.get(uf.find(indexById.get(pair.a)!));
    if (!cluster) continue;
    cluster.pairs.push(pair);
    if (pair.similarity > cluster.topSimilarity) {
      cluster.topSimilarity = pair.similarity;
    }
  }

  return [...groups.values()]
    .filter((cluster) => cluster.cards.length > 1)
    .sort(
      (a, b) =>
        b.topSimilarity - a.topSimilarity || b.cards.length - a.cards.length,
    );
};
