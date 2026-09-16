// Per-round submissions — the one multi-writer object in the Y.Doc.
//
// Every other JSON-blob key in `gameState` has exactly one writer: the judge
// writes `revealedCards`, the host writes `scores` and `skippedPlayers`.
// `submissions` was different. It was written by each submitting player's OWN
// client, which read the whole object, added its own entry, and wrote the whole
// object back. Two players tapping submit inside one network round trip both
// wrote the same Y.Map key from the same starting value, and Yjs resolves that
// last-writer-wins rather than merging — so one player's submission vanished.
//
// Their hand write survived, because `hands` is keyed per player and so never
// collided. That left the player a card short with nothing on the table: not
// the judge, not skipped, no submission, holding nine cards. The round then sat
// in `submitting` waiting on a submission that no longer existed, and the
// played card leaked out of the game entirely — in no hand, in no submission,
// and so never reaching the discard pile. It is what the `hand-underfilled`
// watchdog rule had been reporting.
//
// Submissions now live in their own Y.Map keyed by player id, so two players
// submitting at once touch different keys and neither write is lost.
//
// `mergeSubmissions` is the single reader, and it still reads the retired
// `gameState.submissions` blob: a game in flight when this shipped keeps its
// submissions, and during a mixed-version deploy a client on this build still
// sees what a client on the previous build submitted. Writes deliberately do
// NOT go to the blob as well — dual-writing would put the clobber back on the
// path that matters, because an old client's whole-object write could then
// erase a new client's entry from the only field the old client can see.
// The reverse gap (an old client not seeing a new client's submission) closes
// as soon as every tab has reloaded.

import type { PlayerId, CardId } from "~/types/game";

/** Minimal structural view of the `submissions` Y.Map, so this module stays
 *  Yjs-free and testable with a plain Map. */
export interface SubmissionsMapLike {
  entries(): IterableIterator<[string, any]>;
  keys(): IterableIterator<string>;
  get(key: string): any;
  set(key: string, value: string): unknown;
  delete(key: string): void;
}

/** Minimal structural view of the `gameState` Y.Map. */
export interface GameStateMapLike {
  get(key: string): any;
  set(key: string, value: any): unknown;
}

function parseCardIds(raw: unknown): CardId[] | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CardId[]) : null;
  } catch {
    return null;
  }
}

/** The retired `gameState.submissions` blob, parsed defensively. */
function parseLegacyBlob(raw: unknown): Record<PlayerId, CardId[]> {
  if (typeof raw !== "string") return {};
  const result: Record<PlayerId, CardId[]> = {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    for (const [pid, cards] of Object.entries(parsed)) {
      if (Array.isArray(cards)) result[pid] = cards as CardId[];
    }
  } catch {
    /* a malformed blob must not hide the map's submissions */
  }
  return result;
}

/**
 * The one reader for submissions: the per-player map overlaid on the retired
 * blob. The map wins, since it is where every current client writes.
 */
export function mergeSubmissions(
  legacyRaw: unknown,
  perPlayerRaw: Record<string, unknown>,
): Record<PlayerId, CardId[]> {
  const result = parseLegacyBlob(legacyRaw);

  for (const [pid, raw] of Object.entries(perPlayerRaw)) {
    const cards = parseCardIds(raw);
    if (cards) result[pid] = cards;
  }

  return result;
}

/** `mergeSubmissions` against the live Y.Maps. */
export function readSubmissions(
  gs: GameStateMapLike,
  map: SubmissionsMapLike,
): Record<PlayerId, CardId[]> {
  return mergeSubmissions(
    gs.get("submissions"),
    Object.fromEntries(map.entries()),
  );
}

/** Records one player's play. Per-key, so a second player submitting in the
 *  same instant cannot overwrite it. */
export function writeSubmission(
  map: SubmissionsMapLike,
  playerId: PlayerId,
  cardIds: CardId[],
): void {
  map.set(playerId, JSON.stringify(cardIds));
}

/** Ends the round's submissions. Clears both stores: the blob is still read
 *  here and by any client on the previous build, so a clear that missed it
 *  would resurrect last round's plays. */
export function clearSubmissions(
  gs: GameStateMapLike,
  map: SubmissionsMapLike,
): void {
  for (const key of [...map.keys()]) map.delete(key);
  gs.set("submissions", "{}");
}

/** Drops a single player — used when they leave mid-round. Only the blob's own
 *  entries are rewritten; map entries are never folded into it. */
export function removeSubmission(
  gs: GameStateMapLike,
  map: SubmissionsMapLike,
  playerId: PlayerId,
): void {
  map.delete(playerId);
  const legacy = parseLegacyBlob(gs.get("submissions"));
  if (playerId in legacy) {
    delete legacy[playerId];
    gs.set("submissions", JSON.stringify(legacy));
  }
}
