import { env, evictDurableObject, runInDurableObject, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { DOC_KEY } from "../src/lobbyRoom";
import { connectYClient, waitFor } from "./helpers";

const roomStub = (code: string) => env.LOBBY.get(env.LOBBY.idFromName(code));
const storedDoc = (code: string) =>
  runInDurableObject(roomStub(code), (_room, state) =>
    state.storage.get<Uint8Array>(DOC_KEY),
  );

describe("LobbyRoom persistence", () => {
  it("rejects an invalid lobby code without creating a room", async () => {
    const res = await SELF.fetch("https://sync.test/parties/lobby/bad!code", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(400);
  });

  it("answers /health", async () => {
    const res = await SELF.fetch("https://sync.test/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });

  it("syncs two clients through the room", async () => {
    const a = await connectYClient("SYNCAB");
    await a.synced;
    const b = await connectYClient("SYNCAB");
    await b.synced;
    a.doc.getMap("meta").set("status", "waiting");
    await waitFor(() => b.doc.getMap("meta").get("status") === "waiting");
    a.close();
    b.close();
  });

  it("keeps the doc across a Durable Object restart", async () => {
    const a = await connectYClient("PERSIST1");
    await a.synced;
    a.doc.getMap("meta").set("status", "playing");
    a.close();
    await a.closed.catch(() => undefined);
    await waitFor(() => storedDoc("PERSIST1"));

    await evictDurableObject(roomStub("PERSIST1"), { webSockets: "close" });

    const b = await connectYClient("PERSIST1");
    await b.synced;
    expect(b.doc.getMap("meta").get("status")).toBe("playing");
    b.close();
  });

  it("restores the doc after hibernating with a socket open", async () => {
    const a = await connectYClient("HIBER1");
    await a.synced;
    a.doc.getMap("meta").set("status", "waiting");
    await waitFor(() => storedDoc("HIBER1"));

    await evictDurableObject(roomStub("HIBER1"), { webSockets: "hibernate" });

    // This message wakes the room, which reloads the stored doc.
    a.doc.getMap("gameState").set("round", 1);
    const b = await connectYClient("HIBER1");
    await b.synced;
    await waitFor(() => b.doc.getMap("gameState").get("round") === 1);
    expect(b.doc.getMap("meta").get("status")).toBe("waiting");
    expect(a.ws.readyState).toBe(WebSocket.READY_STATE_OPEN);
    a.close();
    b.close();
  });
});
