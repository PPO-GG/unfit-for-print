// Which players have a socket open. The client sends its player id as the
// `pid` query param; nothing authenticates it, so it feeds the admin monitor
// only — never game logic.

/** Connection-state key for the socket's player id, beside the other stamps. */
export const PLAYER_ID_KEY = "__unfitPlayerId";
const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function playerIdFromUrl(url: string): string | null {
  try {
    const pid = new URL(url).searchParams.get("pid");
    return pid && PLAYER_ID_PATTERN.test(pid) ? pid : null;
  } catch {
    return null;
  }
}

export function summarizePresence(
  conns: { open: boolean; playerId: string | null }[],
): { onlinePlayerIds: string[]; anonymousClients: number } {
  const ids = new Set<string>();
  let anonymousClients = 0;
  for (const conn of conns) {
    if (!conn.open) continue;
    if (conn.playerId) ids.add(conn.playerId);
    else anonymousClients++;
  }
  return { onlinePlayerIds: [...ids], anonymousClients };
}
