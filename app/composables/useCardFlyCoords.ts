/**
 * Shared composable for passing card fly-out coordinates
 * from UserHand → GameTable without DOM coupling.
 *
 * UserHand snapshots the bounding rects of selected cards
 * right before emitting `select-cards`. GameTable reads
 * these rects to start the pile fly-in animation from the
 * correct screen position.
 */
import { ref } from "vue";

export interface CardFlyRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Stores the snapshotted bounding rects of up to N cards keyed
 * by card index (0-based in order of selection).
 * Also stores a centroid representing the average center of all
 * selected cards — this is what GameTable uses as the "start"
 * position for the pile fly-in.
 */
const flyRects = ref<CardFlyRect[]>([]);
const flyCentroid = ref<{ x: number; y: number } | null>(null);

export function useCardFlyCoords() {
  /**
   * Called by UserHand immediately before emitting select-cards.
   * Captures the bounding rects of the selected card DOM elements.
   */
  function snapshotCards(elements: HTMLElement[]) {
    const rects: CardFlyRect[] = [];
    let sumX = 0;
    let sumY = 0;

    for (const el of elements) {
      const r = el.getBoundingClientRect();
      rects.push({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      });
      sumX += r.left + r.width / 2;
      sumY += r.top + r.height / 2;
    }

    flyRects.value = rects;
    flyCentroid.value =
      rects.length > 0
        ? { x: sumX / rects.length, y: sumY / rects.length }
        : null;
  }

  /**
   * Called by GameTable after consuming the coordinates.
   * Returns the centroid and clears the snapshot.
   */
  function consumeCentroid(): { x: number; y: number } | null {
    const c = flyCentroid.value;
    // Clear after consumption so stale data isn't reused
    flyRects.value = [];
    flyCentroid.value = null;
    return c;
  }

  return {
    flyRects,
    flyCentroid,
    snapshotCards,
    consumeCentroid,
  };
}
