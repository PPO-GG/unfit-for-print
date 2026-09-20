/**
 * Card text reaches the DOM through `v-html`, because a black card's blanks
 * are rendered as styled <span> elements rather than literal underscores.
 * That text is user-submitted (`/api/submissions/create`), so it has to be
 * escaped before the blanks are substituted in — otherwise an adopted
 * submission carrying markup executes in every player's browser.
 *
 * Order matters: escape first, then insert the span, so the span we author
 * survives intact while anything the card carried does not.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]!);
}

/** The blank a `_` stands in for on a black card. */
export const BLANK_SPAN =
  '<span style="display:inline-block;width:38%;height:0.75em;vertical-align:-2px;border-bottom:2px solid rgba(255,255,255,.75);margin:0 4px;"></span>';

export function formatCardTextHtml(text: string): string {
  return escapeHtml(text).replace(/_/g, BLANK_SPAN);
}
