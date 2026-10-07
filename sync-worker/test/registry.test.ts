import { env, runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getRegistry } from "../src/registry";
import { STALE_ANY_MS, STALE_EMPTY_MS } from "../src/registryViews";
import type { LobbyRecord } from "../src/types";

const record = (code: string, over: Partial<LobbyRecord> = {}): LobbyRecord => ({
  code, clients: 1, lastActivity: Date.now(), players: [], meta: {}, ...over,
});

describe("LobbyRegistry", () => {
  it("upserts, lists, and removes rows", async () => {
    const registry = getRegistry(env);
    await registry.upsert(record("REGA1", { phase: "waiting" }));
    await registry.upsert(record("REGA1", { phase: "judging" }));
    expect(await registry.has("REGA1")).toBe(true);
    const summary = JSON.parse(await registry.summaryBody());
    expect(summary.lobbies.filter((l: { code: string }) => l.code === "REGA1")).toEqual([
      expect.objectContaining({ code: "REGA1", phase: "judging" }),
    ]);
    await registry.remove("REGA1");
    expect(await registry.has("REGA1")).toBe(false);
  });

  it("drift repair removes an empty row untouched for 15 minutes", async () => {
    const registry = getRegistry(env);
    await registry.upsert(record("REGSTALE", { clients: 0 }), Date.now() - STALE_EMPTY_MS - 1000);
    expect(await runDurableObjectAlarm(registry)).toBe(true);
    expect(await registry.has("REGSTALE")).toBe(false);
  });

  it("drift repair removes an old row whose room has no stored doc", async () => {
    const registry = getRegistry(env);
    await registry.upsert(record("REGGHOST", { clients: 2 }), Date.now() - STALE_ANY_MS - 1000);
    expect(await runDurableObjectAlarm(registry)).toBe(true);
    expect(await registry.has("REGGHOST")).toBe(false);
  });

  it("gcOne answers 404 for an unknown doc id without touching any room", async () => {
    const result = await getRegistry(env).gcOne("lobby/lobby-NOPE99");
    expect(result).toEqual({ status: 404, body: { error: "Document not found", docId: "lobby/lobby-NOPE99" } });
  });
});
