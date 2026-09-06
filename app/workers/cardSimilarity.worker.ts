/**
 * Runs the duplicate-card scan off the main thread so the admin UI stays
 * responsive while it works.
 *
 * This file is deliberately thin — every rule about what counts as a duplicate
 * lives in `~/utils/duplicateScan`, which this imports. The previous worker
 * lived in `public/` as plain JS, so it could neither import shared code nor be
 * unit-tested, and its matching logic had drifted into a copy of its own.
 *
 *   Incoming:  { type: 'scan', cards, threshold, cardType, samePackOnly }
 *   Outgoing:  { type: 'progress', progress }
 *              { type: 'result',   clusters }
 *              { type: 'error',    message }
 */

import {
  findDuplicateClusters,
  type ScannableCard,
} from "~/utils/duplicateScan";

export interface ScanRequest {
  type: "scan";
  cards: ScannableCard[];
  threshold: number;
  cardType: string;
  samePackOnly: boolean;
}

self.addEventListener("message", (event: MessageEvent<ScanRequest>) => {
  const { type, cards, threshold, cardType, samePackOnly } = event.data ?? {};
  if (type !== "scan") return;

  try {
    let lastPct = -1;
    const clusters = findDuplicateClusters(cards, {
      threshold,
      type: cardType,
      samePackOnly,
      onProgress: (progress) => {
        // The util already throttles to whole percentages; guard again so a
        // future change there can't flood the main thread.
        const pct = Math.round(progress * 100);
        if (pct === lastPct) return;
        lastPct = pct;
        self.postMessage({ type: "progress", progress });
      },
    });

    self.postMessage({ type: "result", clusters });
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
