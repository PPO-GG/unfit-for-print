/**
 * Sizing for the game-over headline, which shrinks its font until the longest
 * word fits the container: `font-size = 100cqi / (width × 0.78)`, where 0.78em
 * is Archivo Black's average uppercase character (see GameOver's .go-title).
 */

/** Past this many average characters a word may break mid-word. */
export const LONG_WORD = 20;

// Archivo Black's M and W are about 1em, not 0.78em; emoji render about as wide.
// Flags (regional-indicator pairs) and keycaps (U+20E3) aren't
// Extended_Pictographic, so they are matched separately.
const WIDE = 1.3;
const WIDE_LETTER = /^[MW]$/i;
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;

/** A word's width in average characters, from its grapheme clusters. */
export function wordWidth(chars: string[]): number {
  let width = 0;
  for (const ch of chars) width += WIDE_LETTER.test(ch) || EMOJI.test(ch) ? WIDE : 1;
  return Math.round(width * 10) / 10;
}

/** The width the headline is sized for: its widest word, at most LONG_WORD. */
export function fitWidth(words: string[][]): number {
  return Math.min(LONG_WORD, Math.max(1, ...words.map(wordWidth)));
}
