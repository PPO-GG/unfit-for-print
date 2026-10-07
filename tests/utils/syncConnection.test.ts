// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { trackConnectionHealth } from "~/utils/connectionHealth";
import { createSyncConnection, syncProviderTarget } from "~/utils/syncConnection";

function fakeProvider() {
  const handlers = new Map<string, Set<(...args: any[]) => void>>();
  return {
    synced: false,
    ws: { bufferedAmount: 42 } as { bufferedAmount?: number } | null,
    connect: vi.fn(async () => {}),
    on(event: string, h: (...args: any[]) => void) {
      const set = handlers.get(event) ?? new Set();
      set.add(h);
      handlers.set(event, set);
    },
    off(event: string, h: (...args: any[]) => void) {
      handlers.get(event)?.delete(h);
    },
    emit(event: string, ...args: any[]) {
      for (const h of handlers.get(event) ?? []) h(...args);
    },
    listenerCount: () => [...handlers.values()].reduce((n, s) => n + s.size, 0),
  };
}

describe("syncProviderTarget", () => {
  it("targets the room path on a bare origin", () => {
    expect(syncProviderTarget("wss://sync.unfit.cards", "AB12")).toEqual({
      host: "sync.unfit.cards",
      protocol: "wss",
      prefix: "/parties/lobby/AB12",
    });
  });

  it("keeps the Discord proxy path, with or without a trailing slash", () => {
    for (const base of ["wss://123.discordsays.com/sync", "wss://123.discordsays.com/sync/"]) {
      expect(syncProviderTarget(base, "AB12")).toEqual({
        host: "123.discordsays.com",
        protocol: "wss",
        prefix: "/sync/parties/lobby/AB12",
      });
    }
  });

  it("uses ws for a local server and drops query strings", () => {
    expect(syncProviderTarget("ws://localhost:1235/?token=x", "AB12")).toEqual({
      host: "localhost:1235",
      protocol: "ws",
      prefix: "/parties/lobby/AB12",
    });
  });
});

describe("createSyncConnection", () => {
  it("drives connectionHealth from provider status events", () => {
    const provider = fakeProvider();
    const conn = createSyncConnection(provider);
    const seen = { state: "", reconnects: -1 };
    trackConnectionHealth(
      conn,
      { setState: (s) => (seen.state = s), setReconnectCount: (n) => (seen.reconnects = n) },
      () => true,
    );
    expect(seen.state).toBe("connecting");
    provider.emit("status", { status: "connected" });
    expect(seen).toEqual({ state: "connected", reconnects: 0 });
    provider.emit("status", { status: "disconnected" });
    expect(conn.state.type).toBe("disconnected");
    provider.emit("status", { status: "connected" });
    expect(seen).toEqual({ state: "connected", reconnects: 1 });
  });

  it("connect() delegates to the provider", async () => {
    const provider = fakeProvider();
    await createSyncConnection(provider).connect();
    expect(provider.connect).toHaveBeenCalledTimes(1);
  });

  it("whenSynced resolves on the provider's sync event", async () => {
    const provider = fakeProvider();
    const conn = createSyncConnection(provider);
    const done = conn.whenSynced(1000);
    provider.synced = true;
    provider.emit("sync", true);
    await expect(done).resolves.toBeUndefined();
  });

  it("whenSynced resolves at once when already synced, and times out otherwise", async () => {
    const provider = fakeProvider();
    provider.synced = true;
    await expect(createSyncConnection(provider).whenSynced(10)).resolves.toBeUndefined();
    const slow = fakeProvider();
    await expect(createSyncConnection(slow).whenSynced(10)).rejects.toThrow("sync timeout");
  });

  it("destroy rejects a pending sync wait and detaches every listener", async () => {
    const provider = fakeProvider();
    const conn = createSyncConnection(provider);
    const done = conn.whenSynced(1000);
    conn.destroy();
    await expect(done).rejects.toThrow("destroyed");
    expect(provider.listenerCount()).toBe(0);
  });

  it("reports the socket's buffered bytes", () => {
    const provider = fakeProvider();
    const conn = createSyncConnection(provider);
    expect(conn.diagnostics).toEqual({ bufferedBytes: 42 });
    provider.ws = null;
    expect(conn.diagnostics).toEqual({ bufferedBytes: undefined });
  });
});
