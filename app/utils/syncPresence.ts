/**
 * Query params for the sync socket. `pid` lets the sync worker report which
 * players are connected to the admin lobby monitor. It is not auth and the
 * worker never uses it for game logic.
 */
export function presenceParams(
  playerId: string | null | undefined,
): Record<string, string> {
  return playerId ? { pid: playerId } : {};
}
