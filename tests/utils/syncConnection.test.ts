// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { trackConnectionHealth } from "~/utils/connectionHealth";
import {
  createSyncConnection,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  syncProviderTarget,
  type SyncSocketLike,
} from "~/utils/syncConnection";

function fakeSocket(readyState = 1) {
  const handlers = new Set<(event: unknown) => void>();
  const socket = {
    readyState,
    bufferedAmount: 42,
    send: vi.fn(),
    close: vi.fn(),
    addEventListener(_type: "message", h: (event: unknown) => void) {
      handlers.add(h);
    },
    removeEventListener(_type: "message", h: (event: unknown) => void) {
      handlers.delete(h);
    },
    receive(data: unknown = "pong") {
      for (const h of handlers) h({ data });
    },
    listenerCount: () => handlers.size,
  };
  return socket satisfies SyncSocketLike & Record<string, unknown>;
}

function fakeProvider() {
  const handlers = new Map<string, Set<(...args: any[]) => void>>();
  return {
    synced: false,
    ws: fakeSocket() as SyncSocketLike | null,
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

describe("createSyncConnection heartbeat", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Mirrors YProvider: the socket exists first, then "connected" fires.
  function connectedConnection() {
    vi.useFakeTimers();
    const provider = fakeProvider();
    const socket = provider.ws as ReturnType<typeof fakeSocket>;
    const conn = createSyncConnection(provider);
    provider.emit("status", { status: "connected" });
    return { provider, socket, conn };
  }

  it("pings every interval while the socket is open", () => {
    const { socket } = connectedConnection();
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS - 1);
    expect(socket.send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(socket.send).toHaveBeenCalledWith("ping");
    // Each pong lands before the next tick, so the link stays healthy.
    socket.receive("pong");
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(socket.send).toHaveBeenCalledTimes(2);
    expect(socket.close).not.toHaveBeenCalled();
  });

  it("treats any inbound frame as proof of life", () => {
    const { socket } = connectedConnection();
    // A binary sync frame every 10 s keeps the link alive well past the
    // timeout, even though no pong ever arrives.
    for (let elapsed = 0; elapsed < HEARTBEAT_TIMEOUT_MS * 3; elapsed += 10_000) {
      vi.advanceTimersByTime(10_000);
      socket.receive(new ArrayBuffer(4));
    }
    expect(socket.close).not.toHaveBeenCalled();
  });

  it("closes the socket once after a full timeout of silence", () => {
    const { socket } = connectedConnection();
    vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS);
    expect(socket.close).toHaveBeenCalledTimes(1);
    // Even if the close event is slow to arrive, the same socket is not
    // closed again or pinged.
    const pings = socket.send.mock.calls.length;
    vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS * 2);
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(socket.send).toHaveBeenCalledTimes(pings);
  });

  it("does not ping a socket that is not open", () => {
    vi.useFakeTimers();
    const provider = fakeProvider();
    const socket = provider.ws as ReturnType<typeof fakeSocket>;
    socket.readyState = 0;
    createSyncConnection(provider);
    vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS * 2);
    expect(socket.send).not.toHaveBeenCalled();
    expect(socket.close).not.toHaveBeenCalled();
    provider.ws = null;
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 2);
    expect(socket.send).not.toHaveBeenCalled();
  });

  it("starts a fresh clock on the new socket after a reconnect", () => {
    const { provider, socket, conn } = connectedConnection();
    vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS - HEARTBEAT_INTERVAL_MS);
    provider.emit("status", { status: "disconnected" });
    const next = fakeSocket();
    provider.ws = next;
    provider.emit("status", { status: "connected" });
    expect(socket.listenerCount()).toBe(0);
    expect(next.listenerCount()).toBe(1);
    // The old socket's silence must not count against the new one.
    vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS - 1);
    expect(next.close).not.toHaveBeenCalled();
    conn.destroy();
  });

  it("destroy stops the timer and detaches from the live socket", () => {
    const { socket, conn } = connectedConnection();
    conn.destroy();
    expect(socket.listenerCount()).toBe(0);
    vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS * 3);
    expect(socket.send).not.toHaveBeenCalled();
    expect(socket.close).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
