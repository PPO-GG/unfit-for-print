/**
 * Adapts y-partyserver's YProvider to the connection interface
 * ~/utils/connectionHealth and ~/utils/connectionRevival were written
 * against (Teleportal's): `state.type`, `on("update" | "connected")` with
 * an unsubscribe return, and `connect()`. Keeping that interface means
 * neither file — nor its tests — changed when the sync server did.
 *
 * It also owns the dead-link heartbeat. YProvider has no receive timeout and
 * keeps nothing on an idle socket, so a half-open connection (sleep, NAT
 * timeout, Wi-Fi drop without a close frame) would read "connected" forever.
 * Every HEARTBEAT_INTERVAL_MS the adapter sends the string "ping" (the worker
 * answers "pong" from the runtime), and closes the socket after
 * HEARTBEAT_TIMEOUT_MS without any inbound frame; YProvider's close handler
 * then reports "disconnected" and reconnects. connectionRevival covers a
 * different case: background tabs whose timers the browser froze.
 *
 * Pure and Vue-free so it can be tested with a fake provider.
 */

/** How often a live socket is pinged. */
export const HEARTBEAT_INTERVAL_MS = 15_000;
/** Silence (no inbound frame of any kind) after which the socket is closed. */
export const HEARTBEAT_TIMEOUT_MS = 45_000;

const WS_OPEN = 1;

export type SyncStatus = "connected" | "connecting" | "disconnected";

/** The part of a WebSocket this adapter touches. */
export interface SyncSocketLike {
  readyState: number;
  bufferedAmount?: number;
  send(data: string): void;
  close(): void;
  addEventListener(type: "message", handler: (event: any) => void): void;
  removeEventListener(type: "message", handler: (event: any) => void): void;
}

/** The part of YProvider this adapter touches. */
export interface SyncProviderLike {
  synced: boolean;
  ws: SyncSocketLike | null;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  connect(): unknown;
}

export interface SyncConnection {
  readonly state: { type: string };
  on(event: "update" | "connected", handler: (...args: any[]) => void): () => void;
  connect(): Promise<unknown>;
  /** Resolves once the first sync completes; rejects "sync timeout" or
   *  "destroyed". */
  whenSynced(timeoutMs: number): Promise<void>;
  /** Point-in-time internals for bug reports. Read on demand. */
  readonly diagnostics: { bufferedBytes?: number };
  destroy(): void;
}

/**
 * Where YProvider should connect for a lobby. `baseUrl` is the configured
 * sync server (`wss://sync.unfit.cards`) or, inside the Discord Activity,
 * the same-origin proxy path (`wss://<app>.discordsays.com/sync`). The
 * returned `prefix` is the full socket path — YProvider uses it verbatim.
 */
export function syncProviderTarget(
  baseUrl: string,
  code: string,
): { host: string; protocol: "ws" | "wss"; prefix: string } {
  const url = new URL(baseUrl);
  const basePath = url.pathname.replace(/\/+$/, "");
  return {
    host: url.host,
    protocol: url.protocol === "wss:" ? "wss" : "ws",
    prefix: `${basePath}/parties/lobby/${code}`,
  };
}

export function createSyncConnection(provider: SyncProviderLike): SyncConnection {
  const listeners = {
    update: new Set<(...args: any[]) => void>(),
    connected: new Set<(...args: any[]) => void>(),
  };
  // YProvider connects asynchronously, so a fresh connection is never
  // already up; connectionHealth counts the first "connected" as the open.
  const state = { type: "connecting" as string };
  const pendingSyncs = new Set<(err: Error) => void>();
  let destroyed = false;

  // Heartbeat: liveness is the time of the last inbound frame on the
  // current socket. The socket object changes on every reconnect, so the
  // listener is attached per socket and moved when the socket changes.
  let watched: SyncSocketLike | null = null;
  let lastSeen = Date.now();
  // A socket we already closed: its close event can be slow to arrive, and
  // it must not be closed or pinged again meanwhile.
  let killed: SyncSocketLike | null = null;
  const onFrame = () => {
    lastSeen = Date.now();
  };
  const watch = (socket: SyncSocketLike | null) => {
    if (watched === socket) return;
    watched?.removeEventListener("message", onFrame);
    watched = socket;
    lastSeen = Date.now();
    socket?.addEventListener("message", onFrame);
  };
  const beat = () => {
    const socket = provider.ws;
    if (!socket || socket.readyState !== WS_OPEN || socket === killed) return;
    // Covers a "connected" event that was missed or came first.
    watch(socket);
    try {
      if (Date.now() - lastSeen >= HEARTBEAT_TIMEOUT_MS) {
        killed = socket;
        socket.close();
      } else {
        socket.send("ping");
      }
    } catch {
      // Socket went away mid-beat; YProvider's close handler takes over.
    }
  };
  const heartbeat = setInterval(beat, HEARTBEAT_INTERVAL_MS);

  const onStatus = ({ status }: { status: SyncStatus }) => {
    state.type = status;
    if (status === "connected") watch(provider.ws);
    for (const h of listeners.update) h({ type: status });
    if (status === "connected") for (const h of listeners.connected) h();
  };
  provider.on("status", onStatus);

  return {
    get state() {
      return state;
    },

    on(event, handler) {
      listeners[event].add(handler);
      return () => listeners[event].delete(handler);
    },

    async connect() {
      return provider.connect();
    },

    whenSynced(timeoutMs) {
      if (destroyed) return Promise.reject(new Error("destroyed"));
      if (provider.synced) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const finish = (err?: Error) => {
          clearTimeout(timer);
          provider.off("sync", onSync);
          pendingSyncs.delete(finish);
          if (err) reject(err);
          else resolve();
        };
        const onSync = (isSynced: boolean) => {
          if (isSynced) finish();
        };
        const timer = setTimeout(() => finish(new Error("sync timeout")), timeoutMs);
        provider.on("sync", onSync);
        pendingSyncs.add(finish);
      });
    },

    get diagnostics() {
      return { bufferedBytes: provider.ws?.bufferedAmount };
    },

    destroy() {
      destroyed = true;
      clearInterval(heartbeat);
      watch(null);
      provider.off("status", onStatus);
      listeners.update.clear();
      listeners.connected.clear();
      for (const finish of [...pendingSyncs]) finish(new Error("destroyed"));
    },
  };
}
