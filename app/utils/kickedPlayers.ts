// app/utils/kickedPlayers.ts
// The Y.Doc marker that tells a kicked player's client to go home.
//
// Kicking removes the player's entry from the `players` map, but an absent
// entry alone is not a safe signal: entries also go missing when a client
// reconnects (see the re-add path in pages/game/[code].vue), and treating
// that as a kick would throw people out of games they are still in. So the
// host's client writes an explicit marker into `meta` as well.
//
// One key per player (`kicked:<userId>`) rather than a single JSON list:
// meta values are whole strings, so two kicks landing together on one shared
// key would be last-writer-wins and one marker would vanish — the same
// clobber that moved submissions into their own map. Re-adding the player
// deletes their key, so someone who rejoins is not sent home again.

export const KICKED_META_PREFIX = "kicked:";

export function kickedMetaKey(userId: string): string {
  return `${KICKED_META_PREFIX}${userId}`;
}

/** userId → when they were kicked, from a raw `meta` map snapshot. */
export function readKickedAt(meta: Record<string, unknown>): Record<string, number> {
  const kicked: Record<string, number> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (key.startsWith(KICKED_META_PREFIX) && typeof value === "number") {
      kicked[key.slice(KICKED_META_PREFIX.length)] = value;
    }
  }
  return kicked;
}
