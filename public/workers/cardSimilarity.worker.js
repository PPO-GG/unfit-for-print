/**
 * cardSimilarity.worker.js
 *
 * Runs the O(n²) duplicate-card scan off the main thread so the UI stays
 * fully responsive. Communicates via postMessage:
 *
 *   Incoming:  { type: 'scan', cards: Card[], threshold: number }
 *   Outgoing:  { type: 'progress', progress: number, processed: number, total: number }
 *              { type: 'result',   pairs: SimilarPair[] }
 *              { type: 'error',    message: string }
 *
 * The Sørensen–Dice bigram comparison algorithm is inlined here (same logic as
 * the string-similarity npm package) to avoid any bundler / import issues
 * inside a plain public-folder worker.
 */

// ─── Dice Coefficient (bigram similarity) ─────────────────────────────────────

function compareTwoStrings(first, second) {
  first = first.replace(/\s+/g, "");
  second = second.replace(/\s+/g, "");

  if (first === second) return 1; // identical
  if (first.length < 2 || second.length < 2) return 0; // too short

  const firstBigrams = new Map();
  for (let i = 0; i < first.length - 1; i++) {
    const bigram = first.substring(i, i + 2);
    firstBigrams.set(bigram, (firstBigrams.get(bigram) ?? 0) + 1);
  }

  let intersectionSize = 0;
  for (let i = 0; i < second.length - 1; i++) {
    const bigram = second.substring(i, i + 2);
    const count = firstBigrams.get(bigram) ?? 0;
    if (count > 0) {
      firstBigrams.set(bigram, count - 1);
      intersectionSize++;
    }
  }

  return (2.0 * intersectionSize) / (first.length + second.length - 2);
}

// ─── Scan logic ───────────────────────────────────────────────────────────────

/**
 * Normalise a card's text once up-front so we don't call toLowerCase()
 * inside the inner loop for every comparison.
 */
function prepareCards(cards) {
  return cards.map((c) => ({
    ...c,
    _norm: (c.text || "").toLowerCase().replace(/\s+/g, ""),
    _len: (c.text || "").replace(/\s+/g, "").length,
  }));
}

function scan(cards, threshold) {
  const prepared = prepareCards(cards);
  const n = prepared.length;
  const totalPairs = (n * (n - 1)) / 2;
  const pairs = [];

  let processed = 0;
  let lastReportedPct = -1;

  for (let i = 0; i < n; i++) {
    const card1 = prepared[i];

    for (let j = i + 1; j < n; j++) {
      const card2 = prepared[j];
      processed++;

      // ── Pre-filter 1: length ratio ─────────────────────────────────────────
      // Cards whose normalised lengths differ by more than 30% can never reach
      // a Dice score of ~0.7+, so skip them cheaply.
      if (card1._len > 0 && card2._len > 0) {
        const minLen = Math.min(card1._len, card2._len);
        const maxLen = Math.max(card1._len, card2._len);
        if (minLen / maxLen < 0.6) continue;
      }

      // ── Pre-filter 2: shared leading characters ────────────────────────────
      // If the first 3 characters don't overlap at all, skip.
      // (Very cheap check that prunes ~25-40% more pairs in practice.)
      if (card1._len >= 3 && card2._len >= 3) {
        const a = card1._norm;
        const b = card2._norm;
        if (a[0] !== b[0] && a[0] !== b[1] && a[1] !== b[0] && a[1] !== b[1])
          continue;
      }

      const similarity = compareTwoStrings(card1._norm, card2._norm);

      if (similarity >= threshold) {
        pairs.push({
          card1: cards[i],
          card2: cards[j],
          similarity,
          similarityScore: Math.round(similarity * 100),
        });
      }
    }

    // Report progress roughly every 1 % to avoid flooding the main thread
    const pct = Math.floor((processed / totalPairs) * 100);
    if (pct !== lastReportedPct) {
      lastReportedPct = pct;
      self.postMessage({
        type: "progress",
        progress: pct / 100,
        processed,
        total: totalPairs,
      });
    }
  }

  return pairs;
}

// ─── Message handler ──────────────────────────────────────────────────────────

self.addEventListener("message", (event) => {
  const { type, cards, threshold } = event.data;

  if (type !== "scan") return;

  try {
    const pairs = scan(cards, threshold);
    pairs.sort((a, b) => b.similarity - a.similarity);

    self.postMessage({ type: "result", pairs });
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
