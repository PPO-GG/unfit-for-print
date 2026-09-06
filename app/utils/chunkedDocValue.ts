/**
 * Splitting large Y.Doc values across several keys.
 *
 * Teleportal drops a single update over roughly 58-66 KB on the way to the
 * server — silently, with no error on either side — so the document ends up
 * missing whatever that update carried. With every card pack enabled the game's
 * opening write is well past that: `blackPicks` alone is ~58.6 KB and
 * `blackDeck` ~55.7 KB. Written as one key each, the server may never receive
 * them, and then there is no state for anyone to sync or snapshot.
 *
 * Many small updates accumulate on the server perfectly well (verified to
 * 250 KB), so the fix is simply to write less per update.
 *
 * Storage shape matches the existing `cardTexts_0…N` convention this codebase
 * already reads: a `<key>Chunks` count plus `<key>_0`, `<key>_1`, … Readers
 * prefer chunks and fall back to a plain `<key>`, so documents created before
 * chunking — a game in flight across a deploy — keep working.
 */

/**
 * Byte budget per chunk. Comfortably under the ~58 KB write ceiling, with room
 * for the rest of a transaction's updates to ride along in the same message.
 */
export const CHUNK_MAX_BYTES = 32 * 1024;

/** Serialised size of a value once it is a JSON string. */
const bytes = (s: string) =>
  typeof Buffer !== "undefined"
    ? Buffer.byteLength(s)
    : new TextEncoder().encode(s).length;

function safeParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Splits an array into JSON strings, each within the budget.
 *
 * An element too large to fit on its own is emitted in a chunk of its own and
 * left over budget: an over-budget chunk is a visible problem, a silently
 * dropped element is not.
 */
export function splitArrayChunks<T>(
  items: T[],
  maxBytes: number = CHUNK_MAX_BYTES,
): string[] {
  if (items.length === 0) return ["[]"];

  const chunks: string[] = [];
  let current: T[] = [];

  for (const item of items) {
    const next = [...current, item];
    if (current.length > 0 && bytes(JSON.stringify(next)) > maxBytes) {
      chunks.push(JSON.stringify(current));
      current = [item];
    } else {
      current = next;
    }
  }
  if (current.length > 0) chunks.push(JSON.stringify(current));
  return chunks;
}

/** Splits a record into JSON strings, each within the budget. */
export function splitRecordChunks(
  record: Record<string, unknown>,
  maxBytes: number = CHUNK_MAX_BYTES,
): string[] {
  const entries = Object.entries(record);
  if (entries.length === 0) return ["{}"];

  const chunks: string[] = [];
  let current: Record<string, unknown> = {};
  let count = 0;

  for (const [key, value] of entries) {
    const next = { ...current, [key]: value };
    if (count > 0 && bytes(JSON.stringify(next)) > maxBytes) {
      chunks.push(JSON.stringify(current));
      current = { [key]: value };
      count = 1;
    } else {
      current = next;
      count++;
    }
  }
  if (count > 0) chunks.push(JSON.stringify(current));
  return chunks;
}

/** The keys a writer should set for `key`, given its chunks. */
export function chunkEntries(
  key: string,
  chunks: string[],
): Array<[string, string]> {
  return [
    [`${key}Chunks`, String(chunks.length)],
    ...chunks.map((c, i) => [`${key}_${i}`, c] as [string, string]),
  ];
}

function chunkCount(raw: Record<string, unknown>, key: string): number {
  const n = parseInt(String(raw[`${key}Chunks`] ?? "0"), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Reads a chunked array, falling back to a plain `<key>` for documents written
 * before chunking. A corrupt chunk contributes nothing rather than discarding
 * the rest.
 */
export function readChunkedArray<T>(
  raw: Record<string, unknown>,
  key: string,
): T[] {
  const n = chunkCount(raw, key);
  if (n === 0) return safeParse<T[]>(raw[key], []);

  const merged: T[] = [];
  for (let i = 0; i < n; i++) {
    merged.push(...safeParse<T[]>(raw[`${key}_${i}`], []));
  }
  return merged;
}

/** Reads a chunked record, with the same fallback and corruption behaviour. */
export function readChunkedRecord<T>(
  raw: Record<string, unknown>,
  key: string,
): Record<string, T> {
  const n = chunkCount(raw, key);
  if (n === 0) return safeParse<Record<string, T>>(raw[key], {});

  const merged: Record<string, T> = {};
  for (let i = 0; i < n; i++) {
    Object.assign(merged, safeParse<Record<string, T>>(raw[`${key}_${i}`], {}));
  }
  return merged;
}
