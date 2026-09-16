// src/ttlCache.ts
// Holds one computed value for a fixed window.
//
// Built for /lobbies/summary: every browser on the lobby page polls it, and
// each call rebuilds every live Y.Doc on the same event loop that syncs the
// games. Caching it turns the cost from (viewers × lobbies) into (lobbies)
// per window.
//
// Synchronous on purpose. `compute` runs to completion inside one request
// handler, so no second request can start while it is running — requests
// that arrive during a rebuild already wait for it, with no in-flight
// promise to share.

export interface TtlCache<T> {
  /** The cached value, recomputed if it is older than the TTL. */
  get(): T;
  /** Drops the cached value so the next `get()` recomputes. */
  invalidate(): void;
}

export function createTtlCache<T>(
  ttlMs: number,
  compute: () => T,
  now: () => number = Date.now,
): TtlCache<T> {
  let entry: { value: T; computedAt: number } | null = null;

  return {
    get() {
      const t = now();
      if (!entry || t - entry.computedAt >= ttlMs) {
        entry = { value: compute(), computedAt: t };
      }
      return entry.value;
    },
    invalidate() {
      entry = null;
    },
  };
}
