// Card ids reach the server from the Y.Doc, which carries non-uuid sentinels
// alongside real ids — `nextRound` writes `{ id: "" }` when the black deck runs
// dry. Comparing those against a uuid column is a query error rather than a
// miss, so they are filtered out before they reach a query.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isCardId = (value: unknown): value is string =>
  typeof value === "string" && UUID_RE.test(value);

/** Deduped, uuid-shaped ids from an untrusted array. */
export const cleanCardIds = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter(isCardId))] : [];
