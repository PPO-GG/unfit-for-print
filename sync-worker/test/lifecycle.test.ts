import { env, evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import * as encoding from "lib0/encoding";
import { describe, expect, it } from "vitest";
import * as awarenessProtocol from "y-protocols/awareness";
import * as Y from "yjs";
import { DOC_KEY } from "../src/lobbyRoom";
import { getRegistry } from "../src/registry";
import { EXPIRY_MS } from "../src/registryViews";
import type { StoredLobby } from "../src/registryViews";
import { connectYClient, waitFor } from "./helpers";

// Longer than the room's 1 s push throttle.
const pastPushThrottle = () => new Promise((resolve) => setTimeout(resolve, 1500));
const roomStub = (code: string) => env.LOBBY.get(env.LOBBY.idFromName(code));
// `meta` is Record<string, unknown>, which the RPC types collapse to never.
const registryRow = async (code: string) =>
  ((await getRegistry(env).rows()) as unknown as StoredLobby[]).find((r) => r.record.code === code);

describe("LobbyRoom lifecycle", () => {
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

    const alarmAt = await waitFor(() =>
      runInDurableObject(roomStub("EXPIRE1"), (_r, s) => s.storage.getAlarm()),
    );
    expect(alarmAt! - Date.now()).toBeGreaterThan(EXPIRY_MS - 30_000);

    expect(await runDurableObjectAlarm(roomStub("EXPIRE1"))).toBe(true);
    expect(
      await runInDurableObject(roomStub("EXPIRE1"), (_r, s) => s.storage.get(DOC_KEY)),
    ).toBeUndefined();
    expect(await getRegistry(env).has("EXPIRE1")).toBe(false);
  });

  it("a reconnect cancels the pending expiry", async () => {
    const a = await connectYClient("EXPIRE2");
    await a.synced;
    a.close();
    await waitFor(() => runInDurableObject(roomStub("EXPIRE2"), (_r, s) => s.storage.getAlarm()));
    const b = await connectYClient("EXPIRE2");
    await b.synced;
    await waitFor(async () =>
      (await runInDurableObject(roomStub("EXPIRE2"), (_r, s) => s.storage.getAlarm())) === null,
    );
    b.close();
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

  // KNOWN GAP (reported, no design change made): after hibernation the room
  // reloads only the small stored copy and, correctly, sends sync step 1 to
  // the connected client. But the client's step 2 reply carries the whole
  // oversize doc (> 1 MiB), so the message guard closes the socket with 1009
  // and the large entries are never recovered. `it.fails` documents the
  // desired behavior; when this starts passing, remove `.fails`.
  it.fails("a client re-supplies what an oversize doc could not persist after hibernation", async () => {
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
  });
});
