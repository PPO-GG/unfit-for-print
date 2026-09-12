// types/gamecards.d.ts
// Card text resolution types — used by the Y.Doc engine and UI components.
// The GameCards database is no longer used; all card data
// lives in the Y.Doc after start.post.ts resolves and embeds it.

import type { CardId } from "./game";

/**
 * Resolved card text entry — returned by /api/cards/resolve.
 * Embedded in the Y.Doc cardTexts map by start.post.ts.
 */
export interface CardTextEntry {
  text: string;
  pack: string;
  /**
   * `card_packs` labelling for `pack`, so the card footer can render it the
   * way every other surface does. Absent on legacy docs, whose embedded
   * cardTexts predate these fields — the footer then falls back to the raw
   * pack key, which is exactly what it used to show.
   */
  packDisplayName?: string | null;
  packSeries?: string | null;
  /** Pick count — only populated for black cards (defaults to 1 when absent) */
  pick?: number;
}

/** Map of cardId → resolved text & pack, shared across GameTable and UserHand */
export type CardTexts = Record<CardId, CardTextEntry>;
