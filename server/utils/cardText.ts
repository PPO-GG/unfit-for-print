/**
 * Card text is rendered through `v-html` (a black card's blanks are styled
 * <span> elements, not literal underscores). `app/utils/cardTextHtml.ts`
 * escapes at that sink, which is what actually stops injection — including
 * for rows already in the table.
 *
 * This is the other half: keep markup out of the column in the first place.
 * The only sanitisation used to live in CardSubmissionForm.vue, in the
 * browser, so POSTing /api/submissions/create directly bypassed it entirely.
 *
 * Reject rather than strip. Card text is a joke someone wrote; silently
 * rewriting it produces a card they did not submit, and a 400 tells them
 * why. A lone `<` is punctuation ("I <3 deadlines"), so only a bracket that
 * opens a real tag counts as markup.
 */

/** Matches CardSubmissionForm.vue's `:maxlength="200"`. */
export const CARD_TEXT_MAX_LENGTH = 200;

const MARKUP = /<[a-z!/?]/i;
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export type CardTextResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export function validateCardText(input: unknown): CardTextResult {
  if (typeof input !== "string") {
    return { ok: false, reason: "text is required" };
  }

  const text = input.replace(CONTROL_CHARS, "").trim();

  if (!text) {
    return { ok: false, reason: "text is required" };
  }
  if (text.length > CARD_TEXT_MAX_LENGTH) {
    return { ok: false, reason: `text must be ${CARD_TEXT_MAX_LENGTH} characters or fewer` };
  }
  if (MARKUP.test(text)) {
    return { ok: false, reason: "text may not contain HTML" };
  }

  return { ok: true, text };
}
