/**
 * Restarts a dead lobby link when the player comes back to it.
 *
 * Teleportal's connection has two ways to stop retrying for good, and both
 * leave the game looking frozen rather than offline:
 *
 * - Going offline cancels the pending reconnect, and its own `online` handler
 *   only resumes from `disconnected` — a link that was mid-retry sits in
 *   `errored` and never tries again.
 * - A backgrounded tab (a phone inside the Discord Activity, mostly) has its
 *   timers throttled or frozen, so the backoff that should revive it doesn't
 *   run until something else wakes the page.
 *
 * `connect()` resets the attempt counter and backoff, so calling it on the
 * two "the player is back" signals — the network returning and the tab being
 * shown — is enough. A link that is connected or already connecting is left
 * alone.
 */

export interface RevivableConnection {
  readonly state: { type: string };
  connect: () => Promise<unknown>;
}

interface ListenerTarget {
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
}

export interface RevivalEnv {
  window: ListenerTarget;
  document: ListenerTarget & { readonly visibilityState: string };
  /** False once this connection has been replaced or torn down. */
  isCurrent: () => boolean;
}

const DEAD_STATES = new Set(["errored", "disconnected"]);

export function reviveConnectionOnReturn(
  connection: RevivableConnection,
  env: RevivalEnv,
): () => void {
  const revive = () => {
    if (!env.isCurrent()) return;
    if (!DEAD_STATES.has(connection.state?.type)) return;
    // connect() rejects when this attempt fails too. The transport's own
    // backoff takes it from there, so there is nothing to surface.
    connection.connect().catch(() => {});
  };

  const onVisibility = () => {
    if (env.document.visibilityState === "visible") revive();
  };

  env.window.addEventListener("online", revive);
  env.document.addEventListener("visibilitychange", onVisibility);

  return () => {
    env.window.removeEventListener("online", revive);
    env.document.removeEventListener("visibilitychange", onVisibility);
  };
}
