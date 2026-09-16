import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { whiteCards, blackCards, cardPacks, users } from "~/server/db/schema";
import { resetCardTables, seedPack, insertCards, packNamesOf, defaultPackNames } from "./helpers/cards";
import { resetUserTables } from "./helpers/users";

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

beforeEach(async () => {
  await resetCardTables();
  await resetUserTables();
  const [admin] = await db
    .insert(users)
    .values({ name: "Admin", isAdmin: true })
    .returning();
  adminId = admin.id;
});

describe("POST /api/admin/cards/move — rename", () => {
  it("renames a pack across both card tables", async () => {
    await insertCards(whiteCards, [
      { text: "w1", pack: "Old" },
      { text: "w2", pack: "Old" },
    ]);
    await insertCards(blackCards, { text: "b1", pack: "Old" });

    const result = await callMove({ from: { pack: "Old" }, toPack: "New", type: "all" });

    expect(result).toEqual({ moved: { white: 2, black: 1 }, aux: "move" });
    expect(await packNamesOf(whiteCards)).toEqual(["New", "New"]);
    expect(await packNamesOf(blackCards)).toEqual(["New"]);
  });

  it("keeps the pack's metadata and default flag on the renamed pack", async () => {
    await insertCards(whiteCards, { text: "w1", pack: "Old" });
    await seedPack("Old", { description: "keep me", nsfw: true, isDefault: true });

    await callMove({ from: { pack: "Old" }, toPack: "New", type: "all" });

    const meta = await db.select().from(cardPacks);
    expect(meta).toHaveLength(1);
    expect(meta[0].name).toBe("New");
    expect(meta[0].description).toBe("keep me");
    expect(meta[0].nsfw).toBe(true);

    expect(await defaultPackNames()).toEqual(["New"]);
  });

  it("is a no-op success when renaming a pack onto its own name", async () => {
    await insertCards(whiteCards, { text: "w1", pack: "Same" });

    const result = await callMove({ from: { pack: "Same" }, toPack: "Same", type: "all" });

    expect(result).toEqual({ moved: { white: 0, black: 0 }, aux: null });
    expect(await packNamesOf(whiteCards)).toEqual(["Same"]);
  });

  it("404s for an unknown source pack instead of reporting a rename", async () => {
    await insertCards(whiteCards, { text: "w1", pack: "Real" });

    await expect(
      callMove({ from: { pack: "Stale Name" }, toPack: "New", type: "all" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      callMove({ from: { packId: "33333333-3333-4333-8333-333333333333" }, toPack: "New", type: "all" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(await packNamesOf(whiteCards)).toEqual(["Real"]);
    expect((await db.select().from(cardPacks)).map((p) => p.name)).toEqual(["Real"]);
  });

  it("renames by keeping the pack's id, so lobbies holding it are unaffected", async () => {
    await insertCards(whiteCards, { text: "w1", pack: "Old" });
    const id = await seedPack("Old");

    await callMove({ from: { pack: "Old" }, toPack: "New", type: "all" });

    const [row] = await db.select().from(cardPacks);
    expect(row).toMatchObject({ id, name: "New" });
  });

  it("creates the destination pack when moving cards by id to a new name", async () => {
    const [card] = await insertCards(whiteCards, { text: "w1", pack: "Source" });

    const result = await callMove({ from: { ids: [card.id] }, toPack: "Brand New", type: "white" });

    expect(result).toEqual({ moved: { white: 1, black: 0 }, aux: null });
    expect(await packNamesOf(whiteCards)).toEqual(["Brand New"]);
  });

  it("moves cards by id to a pack chosen by id", async () => {
    const [card] = await insertCards(whiteCards, { text: "w1", pack: "Source" });
    const targetId = await seedPack("Target");

    await callMove({ from: { ids: [card.id] }, toPackId: targetId, type: "white" });

    expect(await packNamesOf(whiteCards)).toEqual(["Target"]);
  });

  it("finds an existing pack across a double-space typo, merging the second source into the first instead of colliding", async () => {
    await insertCards(whiteCards, { text: "p", pack: "P" });
    await insertCards(whiteCards, { text: "q", pack: "Q" });

    const first = await callMove({ from: { pack: "P" }, toPack: "Y  Z", type: "all" });
    expect(first).toEqual({ moved: { white: 1, black: 0 }, aux: "move" });
    expect(await packNamesOf(whiteCards)).toEqual(["Q", "Y Z"]);

    const second = await callMove({ from: { pack: "Q" }, toPack: "Y  Z", type: "all" });
    expect(second).toEqual({ moved: { white: 1, black: 0 }, aux: "drop" });

    expect(await packNamesOf(whiteCards)).toEqual(["Y Z", "Y Z"]);
    expect((await db.select().from(cardPacks)).map((p) => p.name)).toEqual(["Y Z"]);
  });

  it("creates a normalized name for an id move to a double-spaced destination", async () => {
    const [card] = await insertCards(whiteCards, { text: "w1", pack: "Source" });

    const result = await callMove({ from: { ids: [card.id] }, toPack: "Y  Z", type: "white" });

    expect(result).toEqual({ moved: { white: 1, black: 0 }, aux: null });
    expect(await packNamesOf(whiteCards)).toEqual(["Y Z"]);
  });

  it("finds an existing double-spaced pack by its exact name rather than spawning a twin", async () => {
    const targetId = await seedPack("Cards Against Humanity  Nasty Bundle");
    const [card] = await insertCards(whiteCards, { text: "w1", pack: "Source" });

    await callMove({
      from: { ids: [card.id] },
      toPack: "Cards Against Humanity  Nasty Bundle",
      type: "white",
    });

    expect(await packNamesOf(whiteCards)).toEqual(["Cards Against Humanity  Nasty Bundle"]);
    const matches = await db
      .select()
      .from(cardPacks)
      .where(eq(cardPacks.name, "Cards Against Humanity  Nasty Bundle"));
    expect(matches).toEqual([expect.objectContaining({ id: targetId })]);
  });
});

describe("POST /api/admin/cards/move — merge", () => {
  it("merges into an existing pack and keeps the target's metadata", async () => {
    await insertCards(whiteCards, [
      { text: "src", pack: "Source" },
      { text: "tgt", pack: "Target" },
    ]);
    await seedPack("Source", { description: "source desc" });
    await seedPack("Target", { description: "target desc" });

    const result = await callMove({ from: { pack: "Source" }, toPack: "Target", type: "all" });

    expect(result).toEqual({ moved: { white: 1, black: 0 }, aux: "drop" });
    expect(await packNamesOf(whiteCards)).toEqual(["Target", "Target"]);

    const meta = await db.select().from(cardPacks);
    expect(meta).toHaveLength(1);
    expect(meta[0].name).toBe("Target");
    expect(meta[0].description).toBe("target desc");
  });

  it("treats a metadata row with zero cards as a collision — the target still wins", async () => {
    await insertCards(whiteCards, { text: "src", pack: "Source" });
    await seedPack("Source", { description: "source desc" });
    await seedPack("Ghost", { description: "ghost desc" });

    await callMove({ from: { pack: "Source" }, toPack: "Ghost", type: "all" });

    const meta = await db.select().from(cardPacks);
    expect(meta).toHaveLength(1);
    expect(meta[0].name).toBe("Ghost");
    expect(meta[0].description).toBe("ghost desc");
  });

  it("drops the source's default status rather than granting it to the target", async () => {
    await insertCards(whiteCards, [
      { text: "src", pack: "Source" },
      { text: "tgt", pack: "Target" },
    ]);
    await seedPack("Source", { isDefault: true });
    await seedPack("Target");

    await callMove({ from: { pack: "Source" }, toPack: "Target", type: "all" });

    expect(await defaultPackNames()).toEqual([]);
  });

  it("leaves the target's default status untouched", async () => {
    await insertCards(whiteCards, [
      { text: "src", pack: "Source" },
      { text: "tgt", pack: "Target" },
    ]);
    await seedPack("Source", { isDefault: true });
    await seedPack("Target", { isDefault: true });

    await callMove({ from: { pack: "Source" }, toPack: "Target", type: "all" });

    expect(await defaultPackNames()).toEqual(["Target"]);
  });
});

describe("POST /api/admin/cards/move — partial and by-id", () => {
  it("moves only the listed cards, leaving the source pack intact", async () => {
    const inserted = await insertCards(whiteCards, [
      { text: "move me", pack: "Source" },
      { text: "stay", pack: "Source" },
    ]);
    const moveId = inserted.find((c) => c.text === "move me")!.id;

    const result = await callMove({
      from: { ids: [moveId] },
      toPack: "Target",
      type: "white",
    });

    expect(result).toEqual({ moved: { white: 1, black: 0 }, aux: null });
    expect(await packNamesOf(whiteCards)).toEqual(["Source", "Target"]);
  });

  it("leaves the source's aux rows in place when the pack keeps its other card type", async () => {
    await insertCards(whiteCards, { text: "w", pack: "Mixed" });
    await insertCards(blackCards, { text: "b", pack: "Mixed" });
    await seedPack("Mixed", { description: "still here" });

    const result = await callMove({ from: { pack: "Mixed" }, toPack: "Elsewhere", type: "white" });

    expect(result).toEqual({ moved: { white: 1, black: 0 }, aux: "leave" });
    expect(await packNamesOf(whiteCards)).toEqual(["Elsewhere"]);
    expect(await packNamesOf(blackCards)).toEqual(["Mixed"]);

    const meta = await db.select().from(cardPacks).where(eq(cardPacks.name, "Mixed"));
    expect(meta[0].description).toBe("still here");
  });

  it("carries the aux rows when a single-type move empties the pack", async () => {
    await insertCards(whiteCards, { text: "w", pack: "WhiteOnly" });
    await seedPack("WhiteOnly", { description: "travels" });

    const result = await callMove({ from: { pack: "WhiteOnly" }, toPack: "Renamed", type: "white" });

    expect(result).toEqual({ moved: { white: 1, black: 0 }, aux: "move" });

    const meta = await db.select().from(cardPacks);
    expect(meta).toHaveLength(1);
    expect(meta[0].name).toBe("Renamed");
    expect(meta[0].description).toBe("travels");
  });

  it("moves cards out of any pack when toPack is null", async () => {
    await insertCards(whiteCards, { text: "w", pack: "Source" });

    const result = await callMove({ from: { pack: "Source" }, toPack: null, type: "all" });

    expect(result).toEqual({ moved: { white: 1, black: 0 }, aux: null });

    const [row] = await db.select().from(whiteCards);
    expect(row.packId).toBeNull();
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

  it("rejects a request carrying both a pack and ids", async () => {
    await expect(
      callMove({
        from: { pack: "Source", ids: [crypto.randomUUID()] },
        toPack: "Target",
        type: "white",
      }),
    ).rejects.toThrow(/not both/i);
  });

  it("rejects more than 500 ids", async () => {
    const ids = Array.from({ length: 501 }, () => crypto.randomUUID());
    await expect(
      callMove({ from: { ids }, toPack: "Target", type: "white" }),
    ).rejects.toThrow(/500/);
  });
});
