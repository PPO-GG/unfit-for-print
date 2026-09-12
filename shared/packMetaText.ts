/**
 * Entry-time hygiene for the hand-typed fields on a `card_packs` row.
 *
 * Shared because both ends need the same rule: the admin form applies it so
 * what you see saved is what you typed, and the routes apply it so the
 * database is clean regardless of which client wrote the row.
 *
 * The reason it exists at all is that every surface rendering pack metadata —
 * the card footer, the Labs gallery and lightbox, the admin tile and rail —
 * uppercases in CSS. That makes a stray double space or a SHOUTED series
 * invisible exactly where it is entered, and permanent in the data. Two real
 * rows carried those defects: a series typed "Cards against Humanity", and a
 * pack key with a double space that the series-prefix derivation could
 * therefore never match.
 */

/**
 * Trim, and collapse internal whitespace runs to one space.
 *
 * Returns null for anything blank, matching the form's existing contract that
 * an empty field clears the column rather than storing "".
 *
 * Deliberately does not touch casing: see `looksShouted`, which advises
 * instead. Silently re-casing someone's input is worse than a warning — some
 * pack names really are acronyms, and there is no rule that knows "MCDONALDS"
 * wants to be "McDonald's".
 */
export function normalizePackText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const collapsed = value.trim().replace(/\s+/g, " ");
  return collapsed || null;
}

/** Below this many characters, an all-caps value reads as an acronym. */
const ACRONYM_MAX = 5;

/**
 * Whether a value looks like it was typed in caps rather than written.
 *
 * Advisory only — it drives a hint in the admin form, never a rejection.
 * Tuned to stay quiet on the cases that are legitimately upper, because a
 * warning that cries wolf is one the admin learns to click past: short
 * acronyms ("CAH", "NSFW"), single words, and anything with no cased letters
 * ("2000", an emoji icon).
 */
export function looksShouted(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (text.length <= ACRONYM_MAX) return false;

  // One word is a name, not a sentence being shouted.
  if (!/\s/.test(text)) return false;

  // No cased letters means nothing to be shouted — digits, punctuation, emoji.
  if (text.toLowerCase() === text.toUpperCase()) return false;

  return text === text.toUpperCase();
}
