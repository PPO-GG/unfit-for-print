// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { trackConnectionHealth } from "~/utils/connectionHealth";

/** Stands in for Teleportal's connection: an event emitter whose `on`
 *  returns its own unsubscribe, which is the part teardown relies on. */
function fakeConnection() {
  const handlers = new Map<string, Set<(...args: any[]) => void>>();
  return {
    on(event: string, handler: (...args: any[]) => void) {
      const set = handlers.get(event) ?? new Set();
      set.add(handler);
      handlers.set(event, set);
      return () => set.delete(handler);
    },
    emit(event: string, ...args: any[]) {
      for (const h of handlers.get(event) ?? []) h(...args);
    },
    listenerCount() {
      return [...handlers.values()].reduce((n, s) => n + s.size, 0);
    },
  };
}

function sink() {
  const state: { state: string; reconnects: number } = {
    state: "idle",
    reconnects: 0,
  };
  return {
    state,
    setState: (v: string) => {
      state.state = v;
    },
    setReconnectCount: (n: number) => {
      state.reconnects = n;
    },
  };
}

describe("trackConnectionHealth", () => {
  it("starts as connecting with nothing to reconnect from", () => {
    const s = sink();
    trackConnectionHealth(fakeConnection(), s, () => true);

    expect(s.state).toEqual({ state: "connecting", reconnects: 0 });
  });

  it("mirrors the transport's own state", () => {
    const conn = fakeConnection();
    const s = sink();
    trackConnectionHealth(conn, s, () => true);

    conn.emit("update", { type: "connected" });
    expect(s.state.state).toBe("connected");

    conn.emit("update", { type: "disconnected" });
    expect(s.state.state).toBe("disconnected");
  });

  it("records an unrecognised state rather than dropping it", () => {
    const conn = fakeConnection();
    const s = sink();
    trackConnectionHealth(conn, s, () => true);

    conn.emit("update", undefined);
    expect(s.state.state).toBe("unknown");
  });

  // The whole point of the field: one open is a connection, two is a link
  // that dropped and came back, which is the shape of the bug it exists to
  // distinguish from a logic fault.
  it("counts opens after the first as reconnections", () => {
    const conn = fakeConnection();
    const s = sink();
    trackConnectionHealth(conn, s, () => true);

    conn.emit("connected");
    expect(s.state.reconnects).toBe(0);

    conn.emit("connected");
    conn.emit("connected");
    expect(s.state.reconnects).toBe(2);
  });

  it("ignores a late event from a connection that is no longer current", () => {
    const conn = fakeConnection();
    const s = sink();
    let current = true;
    trackConnectionHealth(conn, s, () => current);

    conn.emit("connected");
    current = false;
    conn.emit("connected");
    conn.emit("update", { type: "errored" });

    expect(s.state).toEqual({ state: "connecting", reconnects: 0 });
  });

  it("detaches every listener when torn down", () => {
    const conn = fakeConnection();
    const s = sink();
    const untrack = trackConnectionHealth(conn, s, () => true);

    expect(conn.listenerCount()).toBeGreaterThan(0);
    untrack();
    expect(conn.listenerCount()).toBe(0);

    conn.emit("update", { type: "errored" });
    expect(s.state.state).toBe("connecting");
  });

  it("survives a connection whose on() returns nothing to unsubscribe with", () => {
    const s = sink();
    const untrack = trackConnectionHealth(
      { on: vi.fn() },
      s,
      () => true,
    );

    expect(() => untrack()).not.toThrow();
  });
});
