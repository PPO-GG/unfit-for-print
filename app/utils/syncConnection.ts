/**
 * Adapts y-partyserver's YProvider to the connection interface
 * ~/utils/connectionHealth and ~/utils/connectionRevival were written
 * against (Teleportal's): `state.type`, `on("update" | "connected")` with
 * an unsubscribe return, and `connect()`. Keeping that interface means
 * neither file — nor its tests — changed when the sync server did.
 *
 * Pure and Vue-free so it can be tested with a fake provider.
 */

export type SyncStatus = "connected" | "connecting" | "disconnected";

/** The part of YProvider this adapter touches. */
export interface SyncProviderLike {
  synced: boolean;
  ws: { bufferedAmount?: number } | null;
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

  const onStatus = ({ status }: { status: SyncStatus }) => {
    state.type = status;
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
      provider.off("status", onStatus);
      listeners.update.clear();
      listeners.connected.clear();
      for (const finish of [...pendingSyncs]) finish(new Error("destroyed"));
    },
  };
}
