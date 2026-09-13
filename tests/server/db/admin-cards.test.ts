import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, whiteCards, blackCards, players } from "~/server/db/schema";
import { resetCardTables, insertCards, seedPack, packNamesOf, defaultPackNames } from "./helpers/cards";

const db = useDb();
let adminId: string;

vi.mock("~/server/utils/session", () => ({
  requireAdmin: async () => adminId,
}));

beforeEach(async () => {
  await resetCardTables();
  await db.delete(players);
  await db.delete(users);
  const [admin] = await db.insert(users).values({ name: "Admin", isAdmin: true }).returning();
  adminId = admin.id;
});

function mockEvent(body: unknown, query: Record<string, string> = {}) {
  globalThis.readBody = async () => body;
  globalThis.getQuery = () => query;
  return {} as any;
}

describe("admin cards CRUD", () => {
  it("creates a card", async () => {
    const handler = (await import("~/server/api/admin/cards/create.post")).default;
    const result = await handler(mockEvent({ type: "white", text: "New card", pack: "Base" }));
    expect(result.text).toBe("New card");
    expect(result.pack).toBe("Base");
    expect(result.packId).toBe(await seedPack("Base"));

    const [row] = await db.select().from(whiteCards).where(eq(whiteCards.id, result.id));
    expect(row.active).toBe(true);
  });

  it("creates a card in a pack chosen by id", async () => {
    const id = await seedPack("Chosen");
    const handler = (await import("~/server/api/admin/cards/create.post")).default;

    const result = await handler(mockEvent({ type: "white", text: "By id", packId: id }));

    expect(result).toMatchObject({ packId: id, pack: "Chosen" });
  });

  it("toggles a card's active flag", async () => {
    const [card] = await db.insert(whiteCards).values({ text: "x", active: true }).returning();
    const handler = (await import("~/server/api/admin/cards/toggle.post")).default;
    const result = await handler(mockEvent({ id: card.id, type: "white" }));
    expect(result.active).toBe(false);
  });

  it("toggles an entire pack", async () => {
    await insertCards(blackCards, [
      { text: "a?", pack: "Base", active: true, pick: 1 },
      { text: "b?", pack: "Base", active: true, pick: 1 },
    ]);
    const handler = (await import("~/server/api/admin/cards/toggle-pack.post")).default;
    await handler(mockEvent({ pack: "Base", type: "black", active: false }));

    const rows = await db.select().from(blackCards);
    expect(rows.every((r) => r.active === false)).toBe(true);
  });

  it("toggles a pack's white and black cards together when type is 'all'", async () => {
    await insertCards(whiteCards, { text: "w", pack: "Base", active: true });
    await insertCards(blackCards, { text: "b?", pack: "Base", active: true, pick: 1 });
    // Unrelated pack must be unaffected
    await insertCards(whiteCards, { text: "other", pack: "Other", active: true });

    const handler = (await import("~/server/api/admin/cards/toggle-pack.post")).default;
    await handler(mockEvent({ pack: "Base", type: "all", active: false }));

    const baseId = await seedPack("Base");
    const otherId = await seedPack("Other");
    const whiteRows = await db.select().from(whiteCards);
    const blackRows = await db.select().from(blackCards);
    expect(whiteRows.find((r) => r.packId === baseId)!.active).toBe(false);
    expect(blackRows.find((r) => r.packId === baseId)!.active).toBe(false);
    expect(whiteRows.find((r) => r.packId === otherId)!.active).toBe(true);
  });

  it("edits card text and pick", async () => {
    const [card] = await db.insert(blackCards).values({ text: "old?", pick: 1 }).returning();
    const handler = (await import("~/server/api/admin/cards/edit.post")).default;
    const result = await handler(mockEvent({ id: card.id, type: "black", text: "new?", pick: 2 }));
    expect(result.text).toBe("new?");
    expect(result.pick).toBe(2);
  });

  it("deletes a card", async () => {
    const [card] = await db.insert(whiteCards).values({ text: "gone" }).returning();
    const handler = (await import("~/server/api/admin/cards/delete.post")).default;
    await handler(mockEvent({ id: card.id, type: "white" }));

    const rows = await db.select().from(whiteCards).where(eq(whiteCards.id, card.id));
    expect(rows).toHaveLength(0);
  });

  it("lists cards filtered by pack and search text", async () => {
    await insertCards(whiteCards, [
      { text: "Apples", pack: "Base" },
      { text: "Oranges", pack: "Base" },
      { text: "Apples again", pack: "Other" },
    ]);
    const handler = (await import("~/server/api/admin/cards/list.get")).default;
    const result = await handler(
      mockEvent(undefined, { type: "white", pack: "Base", search: "Apple" }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Apples");
  });

  it("deletes an entire pack including white, black, and default pack entry", async () => {
    await insertCards(whiteCards, [
      { text: "w1", pack: "Base" },
      { text: "w2", pack: "Other" },
    ]);
    await insertCards(blackCards, [
      { text: "b1?", pack: "Base", pick: 1 },
      { text: "b2?", pack: "Other", pick: 1 },
    ]);
    await seedPack("Base", { isDefault: true });
    await seedPack("Other", { isDefault: true });

    const handler = (await import("~/server/api/admin/cards/delete-pack.post")).default;
    const result = await handler(mockEvent({ pack: "Base", type: "all" }));
    expect(result.success).toBe(true);

    expect(await packNamesOf(whiteCards)).toEqual(["Other"]);
    expect(await packNamesOf(blackCards)).toEqual(["Other"]);
    expect(await defaultPackNames()).toEqual(["Other"]);
  });

  it("deletes only a specific card type in a pack", async () => {
    await insertCards(whiteCards, [{ text: "w1", pack: "Base" }]);
    await insertCards(blackCards, [{ text: "b1?", pack: "Base", pick: 1 }]);
    await seedPack("Base", { isDefault: true });

    const handler = (await import("~/server/api/admin/cards/delete-pack.post")).default;
    await handler(mockEvent({ pack: "Base", type: "white" }));

    const remainingWhite = await db.select().from(whiteCards);
    const remainingBlack = await db.select().from(blackCards);

    expect(remainingWhite).toHaveLength(0);
    expect(remainingBlack).toHaveLength(1);
    // Base pack still has black cards, so its registry row (and default flag) remains
    expect(await defaultPackNames()).toEqual(["Base"]);

    // Now delete remaining black cards -> the registry row should also be cleaned up
    await handler(mockEvent({ pack: "Base", type: "black" }));
    const finalBlack = await db.select().from(blackCards);
    expect(finalBlack).toHaveLength(0);
    expect(await defaultPackNames()).toEqual([]);
  });
});

describe("admin cards set-active", () => {
  const load = () =>
    import("~/server/api/admin/cards/set-active.post").then((m) => m.default);

  it("disables every card it is given in one call", async () => {
    const rows = await db
      .insert(whiteCards)
      .values([
        { text: "dupe a", active: true },
        { text: "dupe b", active: true },
      ])
      .returning();

    const handler = await load();
    const result = await handler(
      mockEvent({ ids: rows.map((r) => r.id), type: "white", active: false }),
    );

    expect(result.updated).toBe(2);
    const after = await db.select().from(whiteCards);
    expect(after.every((r) => r.active === false)).toBe(true);
  });

  it("is idempotent, unlike toggle", async () => {
    // The whole point of not reusing toggle.post: resolving the same duplicate
    // cluster twice must not quietly put the card back into rotation.
    const [card] = await db
      .insert(whiteCards)
      .values({ text: "already off", active: false })
      .returning();

    const handler = await load();
    await handler(mockEvent({ ids: [card.id], type: "white", active: false }));

    const [after] = await db
      .select()
      .from(whiteCards)
      .where(eq(whiteCards.id, card.id));
    expect(after.active).toBe(false);
  });

  it("leaves cards outside the id list untouched", async () => {
    const [target] = await db
      .insert(whiteCards)
      .values({ text: "target", active: true })
      .returning();
    const [bystander] = await db
      .insert(whiteCards)
      .values({ text: "bystander", active: true })
      .returning();

    const handler = await load();
    await handler(mockEvent({ ids: [target.id], type: "white", active: false }));

    const [after] = await db
      .select()
      .from(whiteCards)
      .where(eq(whiteCards.id, bystander.id));
    expect(after.active).toBe(true);
  });

  it("re-enables cards when active is true", async () => {
    const [card] = await db
      .insert(whiteCards)
      .values({ text: "restore me", active: false })
      .returning();

    const handler = await load();
    await handler(mockEvent({ ids: [card.id], type: "white", active: true }));

    const [after] = await db
      .select()
      .from(whiteCards)
      .where(eq(whiteCards.id, card.id));
    expect(after.active).toBe(true);
  });

  it("disables black cards too", async () => {
    const [card] = await db
      .insert(blackCards)
      .values({ text: "why _?", active: true, pick: 1 })
      .returning();

    const handler = await load();
    await handler(mockEvent({ ids: [card.id], type: "black", active: false }));

    const [after] = await db
      .select()
      .from(blackCards)
      .where(eq(blackCards.id, card.id));
    expect(after.active).toBe(false);
  });

  it("rejects an empty id list rather than touching the whole table", async () => {
    await db.insert(whiteCards).values({ text: "safe", active: true });

    const handler = await load();
    await expect(
      handler(mockEvent({ ids: [], type: "white", active: false })),
    ).rejects.toThrow();

    const after = await db.select().from(whiteCards);
    expect(after.every((r) => r.active === true)).toBe(true);
  });

  it("rejects a non-boolean active flag", async () => {
    const [card] = await db
      .insert(whiteCards)
      .values({ text: "safe", active: true })
      .returning();

    const handler = await load();
    await expect(
      handler(mockEvent({ ids: [card.id], type: "white" })),
    ).rejects.toThrow();
  });
});
