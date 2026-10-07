import { env, evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import * as encoding from "lib0/encoding";
import { describe, expect, it } from "vitest";
import * as awarenessProtocol from "y-protocols/awareness";
import * as Y from "yjs";
import {
  CONNECTED_AT_KEY,
  DOC_KEY,
  EXPIRES_AT_KEY,
  HEARTBEAT_TIMEOUT_CODE,
  REAP_INTERVAL_MS,
  STALE_SOCKET_MS,
} from "../src/lobbyRoom";
import { getRegistry } from "../src/registry";
import { EXPIRY_MS } from "../src/registryViews";
import type { StoredLobby } from "../src/registryViews";
import { connectYClient, waitFor } from "./helpers";

// Longer than the room's 1 s push throttle.
const pastPushThrottle = () => new Promise((resolve) => setTimeout(resolve, 1500));
const roomStub = (code: string) => env.LOBBY.get(env.LOBBY.idFromName(code));
const storedExpiry = (code: string) =>
  runInDurableObject(roomStub(code), (_r, s) => s.storage.get<number>(EXPIRES_AT_KEY));
const alarmOf = (code: string) =>
  runInDurableObject(roomStub(code), (_r, s) => s.storage.getAlarm());
/** Moves the room's clock forward, so an alarm run sees its deadline as passed. */
const skipRoomClock = (code: string, ms: number) =>
  runInDurableObject(roomStub(code), (room) => {
    (room as unknown as { now: () => number }).now = () => Date.now() + ms;
  });
/** Backdates every socket's recorded connect time by `ms`. */
const backdateConnects = (code: string, ms: number) =>
  runInDurableObject(roomStub(code), (room) => {
    for (const conn of room.getConnections()) {
      conn.setState((prev: unknown) => ({
        ...(prev as object),
        [CONNECTED_AT_KEY]: Date.now() - ms,
      }));
    }
  });
// `meta` is Record<string, unknown>, which the RPC types collapse to never.
const registryRow = async (code: string) =>
  ((await getRegistry(env).rows()) as unknown as StoredLobby[]).find((r) => r.record.code === code);

describe("LobbyRoom lifecycle", () => {
  it("answers a string ping with pong without treating it as a sync message", async () => {
    const a = await connectYClient("PING1");
    await a.synced;
    const pong = new Promise<string>((resolve) =>
      a.ws.addEventListener("message", (event) => {
        if (typeof event.data === "string") resolve(event.data);
      }),
    );
    const binaryBefore = a.received.length;
    a.ws.send("ping");
    expect(await pong).toBe("pong");
    // Answered by the runtime: nothing reached the Yjs handler to reply to.
    expect(a.received.length).toBe(binaryBefore);
    a.close();
  });

  it("pushes its summary to the registry", async () => {
    const a = await connectYClient("PUSH1");
    await a.synced;
    a.doc.getMap("players").set("u1", JSON.stringify({ name: "Dylan" }));
    a.doc.getMap("gameState").set("phase", "submitting");
    const row = await waitFor(async () => {
      const r = await registryRow("PUSH1");
      return r?.record.phase === "submitting" ? r : undefined;
    });
    expect(row!.record).toMatchObject({ code: "PUSH1", clients: 1, players: [{ id: "u1", name: "Dylan" }] });
    a.close();
    await waitFor(async () => (await registryRow("PUSH1"))?.record.clients === 0);
  });

  it("sets a 10-minute expiry alarm when the last player leaves, then wipes", async () => {
    const a = await connectYClient("EXPIRE1");
    await a.synced;
    a.doc.getMap("meta").set("status", "waiting");
    await waitFor(() => registryRow("EXPIRE1"));
    a.close();

    const expiresAt = await waitFor(() => storedExpiry("EXPIRE1"));
    expect(expiresAt! - Date.now()).toBeGreaterThan(EXPIRY_MS - 30_000);
    expect(await alarmOf("EXPIRE1")).toBe(expiresAt);

    // Early, the alarm only re-arms for the deadline.
    expect(await runDurableObjectAlarm(roomStub("EXPIRE1"))).toBe(true);
    expect(await runInDurableObject(roomStub("EXPIRE1"), (_r, s) => s.storage.get(DOC_KEY))).toBeDefined();
    expect(await alarmOf("EXPIRE1")).toBe(expiresAt);

    await skipRoomClock("EXPIRE1", EXPIRY_MS + 1000);
    expect(await runDurableObjectAlarm(roomStub("EXPIRE1"))).toBe(true);
    expect(
      await runInDurableObject(roomStub("EXPIRE1"), (_r, s) => s.storage.get(DOC_KEY)),
    ).toBeUndefined();
    expect(await getRegistry(env).has("EXPIRE1")).toBe(false);
  });

  it("a reconnect cancels the pending expiry and leaves a reaper alarm", async () => {
    const a = await connectYClient("EXPIRE2");
    await a.synced;
    a.close();
    await waitFor(() => storedExpiry("EXPIRE2"));
    const b = await connectYClient("EXPIRE2");
    await b.synced;
    await waitFor(async () => (await storedExpiry("EXPIRE2")) === undefined);
    const alarmAt = await alarmOf("EXPIRE2");
    expect(alarmAt).not.toBeNull();
    expect(alarmAt!).toBeLessThanOrEqual(Date.now() + REAP_INTERVAL_MS);
    b.close();
  });

  it("reaps a socket that never pings, then starts the expiry clock", async () => {
    const a = await connectYClient("REAP1");
    await a.synced;
    a.doc.getMap("meta").set("status", "playing");
    await waitFor(async () => (await registryRow("REAP1"))?.record.clients === 1);
    // A reap alarm is pending while the socket is open.
    const reapAt = await alarmOf("REAP1");
    expect(reapAt!).toBeLessThanOrEqual(Date.now() + REAP_INTERVAL_MS);

    await backdateConnects("REAP1", STALE_SOCKET_MS + 5000);
    expect(await runDurableObjectAlarm(roomStub("REAP1"))).toBe(true);

    const closed = await a.closed;
    expect(closed.code).toBe(HEARTBEAT_TIMEOUT_CODE);
    expect(closed.reason).toBe("Heartbeat timeout");
    const expiresAt = await storedExpiry("REAP1");
    expect(expiresAt).toBeDefined();
    expect(Math.abs(expiresAt! - (Date.now() + EXPIRY_MS))).toBeLessThan(30_000);
    expect(await alarmOf("REAP1")).toBe(expiresAt);
    expect(
      await runInDurableObject(roomStub("REAP1"), (room) => [...room.getConnections()].length),
    ).toBe(0);
    // The registry stops counting the vanished player.
    await waitFor(async () => (await registryRow("REAP1"))?.record.clients === 0);

    await skipRoomClock("REAP1", EXPIRY_MS + 1000);
    expect(await runDurableObjectAlarm(roomStub("REAP1"))).toBe(true);
    expect(await runInDurableObject(roomStub("REAP1"), (_r, s) => s.storage.get(DOC_KEY))).toBeUndefined();
    expect(await getRegistry(env).has("REAP1")).toBe(false);
    expect(await alarmOf("REAP1")).toBeNull();
  });

  it("does not reap a socket whose pings are answered", async () => {
    const a = await connectYClient("REAP2");
    await a.synced;
    // Without a ping this socket would be stale: only the ping keeps it.
    await backdateConnects("REAP2", STALE_SOCKET_MS + 5000);
    const pong = new Promise<string>((resolve) =>
      a.ws.addEventListener("message", (event) => {
        if (typeof event.data === "string") resolve(event.data);
      }),
    );
    a.ws.send("ping");
    expect(await pong).toBe("pong");

    expect(await runDurableObjectAlarm(roomStub("REAP2"))).toBe(true);

    expect(a.ws.readyState).toBe(WebSocket.READY_STATE_OPEN);
    expect(await storedExpiry("REAP2")).toBeUndefined();
    const alarmAt = await alarmOf("REAP2");
    expect(alarmAt).not.toBeNull();
    expect(alarmAt! - Date.now()).toBeGreaterThan(REAP_INTERVAL_MS - 30_000);
    expect(alarmAt! - Date.now()).toBeLessThanOrEqual(REAP_INTERVAL_MS);
    a.close();
    await waitFor(() => storedExpiry("REAP2"));
  });

  it("closes a connection that sends a message over 1 MiB", async () => {
    const a = await connectYClient("BIGMSG1");
    await a.synced;
    a.ws.send(new Uint8Array(1024 * 1024 + 1));
    expect((await a.closed).code).toBe(1009);
  });

  it("closes a connection that sends more than 200 messages in a second", async () => {
    const a = await connectYClient("FLOOD1");
    await a.synced;
    for (let i = 0; i < 250; i++) a.ws.send(new Uint8Array([2]));
    expect((await a.closed).code).toBe(1008);
  });

  it("echoes awareness back to the sender, keeping an idle client's link alive", async () => {
    const a = await connectYClient("AWARE1");
    await a.synced;
    const awareness = new awarenessProtocol.Awareness(new Y.Doc());
    awareness.setLocalState({ userId: "u1" });
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 1);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, [awareness.clientID]),
    );
    const before = a.received.length;
    a.ws.send(encoding.toUint8Array(encoder));
    await waitFor(() => a.received.slice(before).some((m) => m[0] === 1));
    a.close();
  });

  it("purge closes sockets, wipes storage and drops the registry row", async () => {
    const a = await connectYClient("PURGE1");
    await a.synced;
    a.doc.getMap("meta").set("status", "playing");
    await waitFor(() => registryRow("PURGE1"));
    await roomStub("PURGE1").purge("PURGE1");
    expect((await a.closed).code).toBe(1000);
    expect(
      await runInDurableObject(roomStub("PURGE1"), (_r, s) => s.storage.get(DOC_KEY)),
    ).toBeUndefined();
    expect(await getRegistry(env).has("PURGE1")).toBe(false);
    // The sockets' close events must not schedule a push that re-creates the row.
    await pastPushThrottle();
    expect(await getRegistry(env).has("PURGE1")).toBe(false);
  });

  it("refresh reports false for a room with nothing stored and no players", async () => {
    expect(await roomStub("NEVERUSED1").refresh("NEVERUSED1")).toBe(false);
  });

  it("refresh arms the expiry alarm for a stored doc whose close events were lost", async () => {
    const doc = new Y.Doc();
    doc.getMap("meta").set("status", "playing");
    await runInDurableObject(roomStub("LOSTCLOSE1"), (_r, s) =>
      s.storage.put(DOC_KEY, Y.encodeStateAsUpdate(doc)),
    );
    expect(
      await runInDurableObject(roomStub("LOSTCLOSE1"), (_r, s) => s.storage.getAlarm()),
    ).toBeNull();

    expect(await roomStub("LOSTCLOSE1").refresh("LOSTCLOSE1")).toBe(true);

    const alarmAt = await runInDurableObject(roomStub("LOSTCLOSE1"), (_r, s) =>
      s.storage.getAlarm(),
    );
    expect(alarmAt).not.toBeNull();
    expect(Math.abs(alarmAt! - (Date.now() + EXPIRY_MS))).toBeLessThan(30_000);
    expect(await storedExpiry("LOSTCLOSE1")).toBe(alarmAt);
    // Wipe so the pushed registry row does not outlive the test.
    await skipRoomClock("LOSTCLOSE1", EXPIRY_MS + 1000);
    expect(await runDurableObjectAlarm(roomStub("LOSTCLOSE1"))).toBe(true);
    expect(await getRegistry(env).has("LOSTCLOSE1")).toBe(false);
  });

  it("does not persist a doc over 1.5 MB, and the game keeps running", async () => {
    const a = await connectYClient("HUGE1");
    await a.synced;
    a.doc.getMap("meta").set("status", "playing");
    a.close();
    await waitFor(() => runInDurableObject(roomStub("HUGE1"), (_r, s) => s.storage.get(DOC_KEY)));

    const b = await connectYClient("HUGE1");
    await b.synced;
    // Two updates, each under the 1 MiB message limit, together over 1.5 MB.
    b.doc.getArray("chat").push(["x".repeat(800_000)]);
    b.doc.getArray("chat").push(["y".repeat(800_000)]);
    await waitFor(async () =>
      (await runInDurableObject(roomStub("HUGE1"), (room) =>
        room.document.getArray("chat").length,
      )) === 2,
    );
    b.close();
    await b.closed.catch(() => undefined);
    // The flush on close skipped the save; storage still holds the small doc.
    const stored = await runInDurableObject(roomStub("HUGE1"), (_r, s) =>
      s.storage.get<Uint8Array>(DOC_KEY),
    );
    expect(stored!.byteLength).toBeLessThan(1_000_000);
  });

  // After hibernation the room reloads only the small stored copy; the
  // connected client answers sync step 1 with a step 2 over 1 MiB, which
  // the guard must let through so the large entries come back.
  it("a client re-supplies what an oversize doc could not persist after hibernation", async () => {
    const a = await connectYClient("HUGE2");
    await a.synced;
    a.doc.getMap("meta").set("status", "playing");
    await waitFor(() => runInDurableObject(roomStub("HUGE2"), (_r, s) => s.storage.get(DOC_KEY)));
    a.doc.getArray("chat").push(["x".repeat(800_000)]);
    a.doc.getArray("chat").push(["y".repeat(800_000)]);
    await waitFor(async () =>
      (await runInDurableObject(roomStub("HUGE2"), (room) =>
        room.document.getArray("chat").length,
      )) === 2,
    );
    // Let the (skipped) debounced save run: storage keeps only the small doc.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const stored = await runInDurableObject(roomStub("HUGE2"), (_r, s) =>
      s.storage.get<Uint8Array>(DOC_KEY),
    );
    expect(stored!.byteLength).toBeLessThan(1_000_000);

    await evictDurableObject(roomStub("HUGE2"), { webSockets: "hibernate" });

    // This small update wakes the room, which reloads only the small copy.
    a.doc.getMap("gameState").set("round", 1);
    await waitFor(
      async () =>
        (await runInDurableObject(roomStub("HUGE2"), (room) =>
          room.document.getArray("chat").length,
        )) === 2,
      5000,
    );
    a.close();
    await a.closed;
    // Let the close-time flush and registry push finish before teardown.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  });
});
