/**
 * Link health for bug reports.
 *
 * `useLobbyDoc`'s `connected` ref only records that connect() ran and
 * disconnect() has not — it never moves when the socket actually drops. That
 * is fine for the app (there is nothing useful to do about a brief drop) and
 * useless for a report, where "the update never arrived" and "the logic is
 * wrong" are the two hypotheses and they look identical in a doc snapshot.
 *
 * Kept out of useLobbyDoc so the wiring is testable without standing up a
 * Provider, a snapshot fetch and a WebSocket.
 */

/** The slice of Teleportal's connection this needs. `on` returns its own
 *  unsubscribe, which is what makes teardown exact. */
export interface ObservableConnection {
  // Loosely typed on purpose. Teleportal's own `on` is generic over a hook-key
  // map, and a `string` event parameter here does not structurally satisfy it
  // — the alternative is a cast at the call site, which would hide a real
  // signature change instead of surfacing it.
  on: (event: any, handler: any) => (() => void) | void;
}

export interface ConnectionHealthSink {
  setState: (state: string) => void;
  /** Opens after the first one. The first is the connection, not a
   *  reconnection. */
  setReconnectCount: (count: number) => void;
}

/**
 * Mirrors a connection's lifecycle onto `sink` until the returned function is
 * called.
 *
 * `isCurrent` guards every handler: disconnect() destroys the connection but
 * these closures outlive it, and a late event from a lobby the player already
 * left must not land on the next lobby's counters.
 */
export function trackConnectionHealth(
  connection: ObservableConnection,
  sink: ConnectionHealthSink,
  isCurrent: () => boolean,
): () => void {
  let opens = 0;
  const unsubscribes: Array<() => void> = [];

  const listen = (event: string, handler: (...args: any[]) => void) => {
    const off = connection.on(event, handler);
    if (typeof off === "function") unsubscribes.push(off);
  };

  sink.setState("connecting");
  sink.setReconnectCount(0);

  listen("update", (state: { type?: string } | undefined) => {
    if (!isCurrent()) return;
    sink.setState(state?.type ?? "unknown");
  });

  listen("connected", () => {
    if (!isCurrent()) return;
    opens += 1;
    sink.setReconnectCount(Math.max(0, opens - 1));
  });

  return () => {
    for (const off of unsubscribes) {
      try {
        off();
      } catch {
        // Best-effort: the connection may already be destroyed.
      }
    }
    unsubscribes.length = 0;
  };
}
