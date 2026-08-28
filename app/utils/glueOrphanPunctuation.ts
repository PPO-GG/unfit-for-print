const NON_BREAKING_SPACE = "\u00A0";

/**
 * Replaces the space before any punctuation-only run (",", ".", "...",
 * "?!", etc.) with a non-breaking space, so it can never wrap onto its
 * own line as an orphan - mid-sentence ("Pongus , God") or trailing
 * ("suicide ."). Only touches punctuation that's already separated by
 * whitespace in the source text - "word," (no space) is untouched since
 * it already wraps as one unbreakable unit.
 */
export function glueOrphanPunctuation(text: string): string {
  return text.replace(/[ \t]+([^\sa-zA-Z0-9]+)(?=\s|$)/g, NON_BREAKING_SPACE + "$1");
}
