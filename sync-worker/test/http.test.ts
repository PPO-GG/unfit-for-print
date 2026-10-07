import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { getRegistry } from "../src/registry";
import { connectYClient, waitFor } from "./helpers";

const call = (path: string, init: RequestInit = {}) =>
  SELF.fetch(`https://sync.test${path}`, init);
const admin = { Authorization: "Bearer test-admin-token" };

describe("HTTP endpoints", () => {
  it("answers CORS preflight for an allowed origin", async () => {
    const res = await call("/lobbies/summary", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
  });

  it("falls back to the production origin for unknown origins", async () => {
    const res = await call("/lobbies/summary", { headers: { Origin: "https://evil.test" } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://unfit.cards");
  });

  it("serves /lobbies/summary publicly", async () => {
    const a = await connectYClient("HTTPSUM1");
    await a.synced;
    a.doc.getMap("settings").set("lobbyName", "Party Night");
    await waitFor(async () => (await getRegistry(env).has("HTTPSUM1")) && true);
    const body = await waitFor(async () => {
      const b: any = await (await call("/lobbies/summary")).json();
      const lobby = b.lobbies.find((l: any) => l.code === "HTTPSUM1");
      return lobby?.lobbyName === "Party Night" ? b : undefined;
    });
    expect(body.timestamp).toEqual(expect.any(Number));
    a.close();
  });

  it("requires the admin token on /status and /gc", async () => {
    expect((await call("/status")).status).toBe(401);
    expect((await call("/status", { headers: { Authorization: "Bearer wrong" } })).status).toBe(401);
    expect((await call("/gc", { method: "POST" })).status).toBe(401);
    expect((await call("/gc/lobby%2Flobby-X", { method: "DELETE" })).status).toBe(401);
  });

  it("serves /status with the admin token", async () => {
    const a = await connectYClient("HTTPSTAT1");
    await a.synced;
    a.doc.getMap("gameState").set("phase", "judging");
    const body: any = await waitFor(async () => {
      const b: any = await (await call("/status", { headers: admin })).json();
      return b.documents["lobby/lobby-HTTPSTAT1"]?.phase === "judging" ? b : undefined;
    });
    expect(body.documents["lobby/lobby-HTTPSTAT1"]).toMatchObject({ clients: 1, phase: "judging" });
    a.close();
  });

  it("DELETE /gc/:docId accepts a URL-encoded doc id", async () => {
    const a = await connectYClient("HTTPGC1");
    await a.synced;
    a.doc.getMap("meta").set("status", "waiting");
    await waitFor(() => getRegistry(env).has("HTTPGC1"));
    const res = await call(`/gc/${encodeURIComponent("lobby/lobby-HTTPGC1")}`, {
      method: "DELETE",
      headers: admin,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ removed: "lobby/lobby-HTTPGC1" });
    expect((await a.closed).code).toBe(1000);
  });

  it("DELETE /gc/:docId is 404 for an unknown lobby", async () => {
    const res = await call(`/gc/${encodeURIComponent("lobby/lobby-NOPE42")}`, {
      method: "DELETE",
      headers: admin,
    });
    expect(res.status).toBe(404);
  });

  it("serves a V2 snapshot of a live lobby", async () => {
    const a = await connectYClient("HTTPSNAP1");
    await a.synced;
    a.doc.getMap("meta").set("status", "playing");
    await waitFor(() => getRegistry(env).has("HTTPSNAP1"));
    const res = await waitFor(async () => {
      const r = await call("/snapshot/HTTPSNAP1");
      return r.status === 200 ? r : undefined;
    });
    const doc = new Y.Doc();
    Y.applyUpdateV2(doc, new Uint8Array(await res!.arrayBuffer()));
    expect(doc.getMap("meta").get("status")).toBe("playing");
    a.close();
  });

  it("snapshot is 404 for an unregistered lobby and 400 for a bad code", async () => {
    expect((await call("/snapshot/NOPE77")).status).toBe(404);
    expect((await call("/snapshot/bad!")).status).toBe(400);
  });

  it("snapshot is 404 for a registered lobby whose doc is still empty", async () => {
    await getRegistry(env).upsert({ code: "EMPTYDOC1", clients: 1, lastActivity: Date.now(), players: [], meta: {} });
    expect((await call("/snapshot/EMPTYDOC1")).status).toBe(404);
  });

  it("POST /gc purges every lobby", async () => {
    const a = await connectYClient("HTTPGCALL1");
    await a.synced;
    a.doc.getMap("meta").set("status", "waiting");
    await waitFor(() => getRegistry(env).has("HTTPGCALL1"));
    const res = await call("/gc", { method: "POST", headers: admin });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ remaining: 0 });
    expect(await getRegistry(env).has("HTTPGCALL1")).toBe(false);
  });

  it("rejects malformed percent-encoding without a 500", async () => {
    const ws = await call("/parties/lobby/%E0%A4%A", { headers: { Upgrade: "websocket" } });
    expect(ws.status).toBe(400);
    expect(await ws.json()).toEqual({ error: "Invalid lobby code" });
    expect((await call("/snapshot/%E0%A4%A")).status).toBe(400);
    const gc = await call("/gc/%E0%A4%A", { method: "DELETE", headers: admin });
    expect(gc.status).toBe(404);
    expect(await gc.json()).toEqual({ error: "Document not found", docId: "%E0%A4%A" });
    expect((await call("/snapshot/%")).status).toBe(400);
  });
});
