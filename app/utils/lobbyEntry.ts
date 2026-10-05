/**
 * What the game page does with a signed-in visitor to /game/[code].
 *
 * The server's player rows decide who belongs: create and join write them,
 * leave and kick delete them. The live Y.Doc is the fast path, but it is not
 * the source of truth for membership. A refresh can arrive before your entry,
 * and the sync server drops a doc entirely once everyone disconnects.
 */
export type LobbyEntry =
  /** In the live doc already: carry on. */
  | "in"
  /** Seated on the server but missing from the doc: add them back. */
  | "rejoin"
  /** The host, and the doc is gone: rebuild it from the lobby row. */
  | "rebuild"
  /** Seated, but the host kicked them: send them home. */
  | "kicked"
  /** Seated in a different lobby: go there. */
  | "redirect"
  /** No seat anywhere relevant: show the join card. */
  | "join";

export interface LobbyEntryFacts {
  /** The synced doc has this user in its players map. */
  inDoc: boolean;
  /** The user's player row is in this lobby. */
  seatedHere: boolean;
  /** The user's player row is in another lobby. */
  seatedElsewhere: boolean;
  /** The doc carries the host's kick marker for this user. */
  kicked: boolean;
  /** The doc has a lobby in it (meta names a host), not an empty shell. */
  docInitialized: boolean;
  /** The lobby row names this user as host. */
  isHost: boolean;
}

export function decideLobbyEntry(f: LobbyEntryFacts): LobbyEntry {
  if (f.inDoc) return "in";
  if (f.seatedHere) {
    if (f.kicked) return "kicked";
    return !f.docInitialized && f.isHost ? "rebuild" : "rejoin";
  }
  if (f.seatedElsewhere) return "redirect";
  return "join";
}
