// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { reviveConnectionOnReturn } from "~/utils/connectionRevival";

/** A bare event target standing in for `window` / `document`. */
function fakeTarget() {
  const handlers = new Map<string, Set<() => void>>();
  return {
    addEventListener(event: string, h: () => void) {
      const set = handlers.get(event) ?? new Set();
      set.add(h);
      handlers.set(event, set);
    },
    removeEventListener(event: string, h: () => void) {
      handlers.get(event)?.delete(h);
    },
    fire(event: string) {
      for (const h of handlers.get(event) ?? []) h();
    },
    listenerCount() {
      return [...handlers.values()].reduce((n, s) => n + s.size, 0);
    },
  };
}

function setup(stateType: string, opts: { hidden?: boolean } = {}) {
  const connection = {
    state: { type: stateType },
    connect: vi.fn(() => Promise.resolve()),
  };
  const win = fakeTarget();
  const doc = Object.assign(fakeTarget(), {
    visibilityState: opts.hidden ? "hidden" : "visible",
  });
  let current = true;
  const stop = reviveConnectionOnReturn(connection, {
    window: win,
    document: doc,
    isCurrent: () => current,
  });
  return {
    connection,
    win,
    doc,
    stop,
    retire: () => {
      current = false;
    },
  };
}

describe("reviveConnectionOnReturn", () => {
  // The reported freeze: the transport gave up (or had its retry cancelled
  // by going offline) and sits in `errored` forever. Teleportal's own
  // `online` handler only recovers from `disconnected`.
  it("reconnects an errored link when the network comes back", () => {
    const { connection, win } = setup("errored");
    win.fire("online");
    expect(connection.connect).toHaveBeenCalledTimes(1);
  });

  it("reconnects a dropped link when the tab becomes visible again", () => {
    const { connection, doc } = setup("disconnected");
    doc.fire("visibilitychange");
    expect(connection.connect).toHaveBeenCalledTimes(1);
  });

  it("leaves a hidden tab alone until it is shown", () => {
    const { connection, doc } = setup("errored", { hidden: true });
    doc.fire("visibilitychange");
    expect(connection.connect).not.toHaveBeenCalled();
  });

  it.each(["connected", "connecting"])(
    "does not interrupt a link that is %s",
    (state) => {
      const { connection, win, doc } = setup(state);
      win.fire("online");
      doc.fire("visibilitychange");
      expect(connection.connect).not.toHaveBeenCalled();
    },
  );

  it("swallows a failed reconnect instead of raising it", async () => {
    const { connection, win } = setup("errored");
    connection.connect.mockReturnValueOnce(Promise.reject(new Error("nope")));
    win.fire("online");
    await Promise.resolve();
    expect(connection.connect).toHaveBeenCalledTimes(1);
  });

  it("ignores events once the connection is no longer current", () => {
    const { connection, win, retire } = setup("errored");
    retire();
    win.fire("online");
    expect(connection.connect).not.toHaveBeenCalled();
  });

  it("removes every listener on stop", () => {
    const { win, doc, stop } = setup("errored");
    stop();
    expect(win.listenerCount()).toBe(0);
    expect(doc.listenerCount()).toBe(0);
  });
});
