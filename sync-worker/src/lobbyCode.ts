// Lobby codes and the doc ids Teleportal used for them. The web app's
// mergeLobbies/pruneLobbies parse "lobby/lobby-CODE", so /status keeps it.

export const LOBBY_CODE_PATTERN = /^[A-Za-z0-9]{1,16}$/;

/** Checked before any Durable Object is addressed, so junk paths never
 *  create a room (and its storage). */
export function isLobbyCode(value: string): boolean {
  return LOBBY_CODE_PATTERN.test(value);
}

export function docIdFor(code: string): string {
  return `lobby/lobby-${code}`;
}

export function codeFromDocId(docId: string): string | null {
  const match = /^lobby\/lobby-([A-Za-z0-9]{1,16})$/.exec(docId);
  return match ? match[1]! : null;
}
