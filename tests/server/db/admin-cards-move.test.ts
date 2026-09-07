import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import {
  whiteCards,
  blackCards,
  defaultCardPacks,
  cardPacks,
  users,
} from "~/server/db/schema";

const db = useDb();
let adminId: string;

vi.mock("~/server/utils/session", () => ({
  requireAdmin: async () => adminId,
}));

function mockEvent(body: unknown) {
  globalThis.readBody = async () => body;
  return {} as any;
}

async function callMove(body: unknown) {
  const handler = (await import("~/server/api/admin/cards/move.post")).default;
  return handler(mockEvent(body));
}

const packsOf = async (table: typeof whiteCards | typeof blackCards) =>
  (await db.select({ pack: table.pack }).from(table)).map((r) => r.pack).sort();

beforeEach(async () => {
  await db.delete(cardPacks);
  await db.delete(defaultCardPacks);
  await db.delete(whiteCards);
  await db.delete(blackCards);
  await db.delete(users);
  const [admin] = await db
    .insert(users)
    .values({ name: "Admin", isAdmin: true })
    .returning();
  adminId = admin.id;
});

describe("POST /api/admin/cards/move — rename", () => {
  it("renames a pack across both card tables", async () => {
    await db.insert(whiteCards).values([
      { text: "w1", pack: "Old" },
      { text: "w2", pack: "Old" },
    ]);
    await db.insert(blackCards).values({ text: "b1", pack: "Old" });

    const result = await callMove({ from: { pack: "Old" }, toPack: "New", type: "all" });

    expect(result).toEqual({ moved: { white: 2, black: 1 } });
    expect(await packsOf(whiteCards)).toEqual(["New", "New"]);
    expect(await packsOf(blackCards)).toEqual(["New"]);
  });

  it("carries the card_packs and default_card_packs rows to the new key", async () => {
    await db.insert(whiteCards).values({ text: "w1", pack: "Old" });
    await db.insert(cardPacks).values({ pack: "Old", description: "keep me", nsfw: true });
    await db.insert(defaultCardPacks).values({ pack: "Old" });

    await callMove({ from: { pack: "Old" }, toPack: "New", type: "all" });

    const meta = await db.select().from(cardPacks);
    expect(meta).toHaveLength(1);
    expect(meta[0].pack).toBe("New");
    expect(meta[0].description).toBe("keep me");
    expect(meta[0].nsfw).toBe(true);

    const defaults = await db.select().from(defaultCardPacks);
    expect(defaults.map((d) => d.pack)).toEqual(["New"]);
  });

  it("is a no-op success when renaming a pack onto its own name", async () => {
    await db.insert(whiteCards).values({ text: "w1", pack: "Same" });

    const result = await callMove({ from: { pack: "Same" }, toPack: "Same", type: "all" });

    expect(result).toEqual({ moved: { white: 0, black: 0 } });
    expect(await packsOf(whiteCards)).toEqual(["Same"]);
  });
});

describe("POST /api/admin/cards/move — merge", () => {
  it("merges into an existing pack and keeps the target's metadata", async () => {
    await db.insert(whiteCards).values([
      { text: "src", pack: "Source" },
      { text: "tgt", pack: "Target" },
    ]);
    await db.insert(cardPacks).values([
      { pack: "Source", description: "source desc" },
      { pack: "Target", description: "target desc" },
    ]);

    const result = await callMove({ from: { pack: "Source" }, toPack: "Target", type: "all" });

    expect(result).toEqual({ moved: { white: 1, black: 0 } });
    expect(await packsOf(whiteCards)).toEqual(["Target", "Target"]);

    const meta = await db.select().from(cardPacks);
    expect(meta).toHaveLength(1);
    expect(meta[0].pack).toBe("Target");
    expect(meta[0].description).toBe("target desc");
  });

  it("treats a metadata row with zero cards as a collision — the target still wins", async () => {
    await db.insert(whiteCards).values({ text: "src", pack: "Source" });
    await db.insert(cardPacks).values([
      { pack: "Source", description: "source desc" },
      { pack: "Ghost", description: "ghost desc" },
    ]);

    await callMove({ from: { pack: "Source" }, toPack: "Ghost", type: "all" });

    const meta = await db.select().from(cardPacks);
    expect(meta).toHaveLength(1);
    expect(meta[0].pack).toBe("Ghost");
    expect(meta[0].description).toBe("ghost desc");
  });

  it("drops the source's default status rather than granting it to the target", async () => {
    await db.insert(whiteCards).values([
      { text: "src", pack: "Source" },
      { text: "tgt", pack: "Target" },
    ]);
    await db.insert(defaultCardPacks).values({ pack: "Source" });

    await callMove({ from: { pack: "Source" }, toPack: "Target", type: "all" });

    const defaults = await db.select().from(defaultCardPacks);
    expect(defaults).toEqual([]);
  });
});

describe("POST /api/admin/cards/move — partial and by-id", () => {
  it("moves only the listed cards, leaving the source pack intact", async () => {
    const inserted = await db
      .insert(whiteCards)
      .values([
        { text: "move me", pack: "Source" },
        { text: "stay", pack: "Source" },
      ])
      .returning();
    const moveId = inserted.find((c) => c.text === "move me")!.id;

    const result = await callMove({
      from: { ids: [moveId] },
      toPack: "Target",
      type: "white",
    });

    expect(result).toEqual({ moved: { white: 1, black: 0 } });
    expect(await packsOf(whiteCards)).toEqual(["Source", "Target"]);
  });

  it("leaves the source's aux rows in place when the pack keeps its other card type", async () => {
    await db.insert(whiteCards).values({ text: "w", pack: "Mixed" });
    await db.insert(blackCards).values({ text: "b", pack: "Mixed" });
    await db.insert(cardPacks).values({ pack: "Mixed", description: "still here" });

    await callMove({ from: { pack: "Mixed" }, toPack: "Elsewhere", type: "white" });

    expect(await packsOf(whiteCards)).toEqual(["Elsewhere"]);
    expect(await packsOf(blackCards)).toEqual(["Mixed"]);

    const meta = await db.select().from(cardPacks).where(eq(cardPacks.pack, "Mixed"));
    expect(meta[0].description).toBe("still here");
  });

  it("carries the aux rows when a single-type move empties the pack", async () => {
    await db.insert(whiteCards).values({ text: "w", pack: "WhiteOnly" });
    await db.insert(cardPacks).values({ pack: "WhiteOnly", description: "travels" });

    await callMove({ from: { pack: "WhiteOnly" }, toPack: "Renamed", type: "white" });

    const meta = await db.select().from(cardPacks);
    expect(meta).toHaveLength(1);
    expect(meta[0].pack).toBe("Renamed");
    expect(meta[0].description).toBe("travels");
  });

  it("moves cards out of any pack when toPack is null", async () => {
    await db.insert(whiteCards).values({ text: "w", pack: "Source" });

    await callMove({ from: { pack: "Source" }, toPack: null, type: "all" });

    const [row] = await db.select().from(whiteCards);
    expect(row.pack).toBeNull();
  });
});

describe("POST /api/admin/cards/move — validation", () => {
  it("rejects an empty toPack string", async () => {
    await expect(
      callMove({ from: { pack: "Source" }, toPack: "   ", type: "all" }),
    ).rejects.toThrow(/toPack/i);
  });

  it("rejects a request with neither pack nor ids", async () => {
    await expect(callMove({ from: {}, toPack: "Target" })).rejects.toThrow(/from/i);
  });

  it("rejects more than 500 ids", async () => {
    const ids = Array.from({ length: 501 }, () => crypto.randomUUID());
    await expect(
      callMove({ from: { ids }, toPack: "Target", type: "white" }),
    ).rejects.toThrow(/500/);
  });
});
