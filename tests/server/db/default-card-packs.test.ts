import { describe, it, expect, beforeEach, vi } from "vitest";
import { useDb } from "~/server/db/client";
import { whiteCards, blackCards, defaultCardPacks, users } from "~/server/db/schema";

const db = useDb();
let adminId: string;

vi.mock("~/server/utils/session", () => ({
  requireAdmin: async () => adminId,
}));

function mockEvent(body: unknown, query: Record<string, string> = {}) {
  globalThis.readBody = async () => body;
  globalThis.getQuery = () => query;
  return {} as any;
}

beforeEach(async () => {
  await db.delete(defaultCardPacks);
  await db.delete(whiteCards);
  await db.delete(blackCards);
  await db.delete(users);
  const [admin] = await db.insert(users).values({ name: "Admin", isAdmin: true }).returning();
  adminId = admin.id;
});

describe("GET /api/cards/default-packs", () => {
  it("returns the configured default packs that still have active cards", async () => {
    await db.insert(whiteCards).values({ text: "w", pack: "Base", active: true });
    await db.insert(defaultCardPacks).values([{ pack: "Base" }]);

    const handler = (await import("~/server/api/cards/default-packs.get")).default;
    const result = await handler({} as any);

    expect(result.packs).toEqual(["Base"]);
  });

  it("excludes a configured default pack once all its cards are inactive", async () => {
    await db.insert(whiteCards).values({ text: "w", pack: "Retired", active: false });
    await db.insert(defaultCardPacks).values([{ pack: "Retired" }]);

    const handler = (await import("~/server/api/cards/default-packs.get")).default;
    const result = await handler({} as any);

    expect(result.packs).toEqual([]);
  });

  it("falls back to the built-in base packs (that still have active cards) when none are configured", async () => {
    await db.insert(whiteCards).values([
      { text: "a", pack: "CAH Base Set", active: true },
      { text: "b", pack: "CAH: Blue Box Expansion", active: true },
      { text: "c", pack: "CAH: Green Box Expansion", active: true },
      { text: "d", pack: "CAH: Red Box Expansion", active: true },
    ]);

    const handler = (await import("~/server/api/cards/default-packs.get")).default;
    const result = await handler({} as any);

    expect(result.packs).toEqual([
      "CAH Base Set",
      "CAH: Blue Box Expansion",
      "CAH: Green Box Expansion",
      "CAH: Red Box Expansion",
    ]);
  });

  it("falls back to all active packs when none are configured and built-ins are absent", async () => {
    await db.insert(whiteCards).values([
      { text: "x", pack: "Custom Pack 1", active: true },
      { text: "y", pack: "Custom Pack 2", active: true },
      { text: "z", pack: "Disabled Custom", active: false },
    ]);

    const handler = (await import("~/server/api/cards/default-packs.get")).default;
    const result = await handler({} as any);

    expect(result.packs.sort()).toEqual(["Custom Pack 1", "Custom Pack 2"]);
  });
});

describe("GET /api/admin/cards/default-packs", () => {
  it("returns every configured default pack, even ones with no active cards", async () => {
    await db.insert(whiteCards).values({ text: "w", pack: "Retired", active: false });
    await db.insert(defaultCardPacks).values([{ pack: "Retired" }, { pack: "Base" }]);

    const handler = (await import("~/server/api/admin/cards/default-packs.get")).default;
    const result = await handler(mockEvent(undefined));

    expect(result.packs.sort()).toEqual(["Base", "Retired"]);
  });
});

describe("POST /api/admin/cards/toggle-default-pack", () => {
  it("marks a pack as a default", async () => {
    const handler = (await import("~/server/api/admin/cards/toggle-default-pack.post")).default;
    await handler(mockEvent({ pack: "Base", isDefault: true }));

    const rows = await db.select().from(defaultCardPacks);
    expect(rows.map((r) => r.pack)).toEqual(["Base"]);
  });

  it("unmarks a pack as a default", async () => {
    await db.insert(defaultCardPacks).values({ pack: "Base" });

    const handler = (await import("~/server/api/admin/cards/toggle-default-pack.post")).default;
    await handler(mockEvent({ pack: "Base", isDefault: false }));

    const rows = await db.select().from(defaultCardPacks);
    expect(rows).toHaveLength(0);
  });
});
