import { hyphenateSync } from "hyphen/en-us";

const SOFT_HYPHEN = "\u00AD";
const WORD_WITH_BREAKS = /[A-Za-z\u00AD]+/g;

/**
 * hyphenateSync offers every valid syllable break in a word (e.g.
 * "antibacterial" gets five candidates). Handing all of them to the
 * browser lets it use as many as it needs to hit a target font size,
 * which can fragment one word across four or five lines - worse than the
 * single ugly break we were trying to avoid. Keep only the candidate
 * closest to the middle of the word, so a word can break at most once,
 * at a real syllable boundary, and only when it actually needs to.
 */
function keepOneBreak(word: string): string {
  const positions: number[] = [];
  let clean = "";
  for (const ch of word) {
    if (ch === SOFT_HYPHEN) {
      positions.push(clean.length);
    } else {
      clean += ch;
    }
  }
  if (positions.length <= 1) return word;

  const mid = clean.length / 2;
  let best = positions[0]!;
  let bestDist = Math.abs(best - mid);
  for (const p of positions) {
    const dist = Math.abs(p - mid);
    if (dist < bestDist) {
      best = p;
      bestDist = dist;
    }
  }
  return clean.slice(0, best) + SOFT_HYPHEN + clean.slice(best);
}

/**
 * Leaves ordinary card copy untouched. Text fitting always tries this
 * whole-word form first, so normal cards never display hyphenated words.
 */
export function hyphenateCardText(text: string): string {
  return text;
}

/**
 * Inserts a single soft hyphen (U+00AD) at the most balanced English
 * syllable boundary in each long word, using Liang's hyphenation
 * algorithm with TeX pattern data - not the browser's native
 * `hyphens: auto`, whose dictionary availability (and willingness to
 * find a break point at all) varies by browser and can silently fall
 * back to a raw character-chop. Soft hyphens are invisible unless a
 * break actually lands on one.
 */
export function emergencyHyphenateCardText(text: string): string {
  return hyphenateSync(text).replace(WORD_WITH_BREAKS, keepOneBreak);
}
