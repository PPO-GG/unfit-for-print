/**
 * A lobby's `settings.cardPacks` holds pack ids, but lobbies created before
 * pack ids existed hold names. This tells the two apart on the client, where
 * a name needs mapping to an id before it can be matched against the roster.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPackId(ref: unknown): ref is string {
  return typeof ref === "string" && UUID_RE.test(ref);
}
