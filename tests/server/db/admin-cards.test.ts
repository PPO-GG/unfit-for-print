import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, whiteCards, blackCards, players } from "~/server/db/schema";

const db = useDb();
let adminId: string;

vi.mock("~/server/utils/session", () => ({
  requireAdmin: async () => adminId,
}));

beforeEach(async () => {
  await db.delete(whiteCards);
  await db.delete(blackCards);
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

    const [row] = await db.select().from(whiteCards).where(eq(whiteCards.id, result.id));
    expect(row.active).toBe(true);
  });

  it("toggles a card's active flag", async () => {
    const [card] = await db.insert(whiteCards).values({ text: "x", active: true }).returning();
    const handler = (await import("~/server/api/admin/cards/toggle.post")).default;
    const result = await handler(mockEvent({ id: card.id, type: "white" }));
    expect(result.active).toBe(false);
  });

  it("toggles an entire pack", async () => {
    await db.insert(blackCards).values([
      { text: "a?", pack: "Base", active: true, pick: 1 },
      { text: "b?", pack: "Base", active: true, pick: 1 },
    ]);
    const handler = (await import("~/server/api/admin/cards/toggle-pack.post")).default;
    await handler(mockEvent({ pack: "Base", type: "black", active: false }));

    const rows = await db.select().from(blackCards);
    expect(rows.every((r) => r.active === false)).toBe(true);
  });

  it("toggles a pack's white and black cards together when type is 'all'", async () => {
    await db.insert(whiteCards).values({ text: "w", pack: "Base", active: true });
    await db.insert(blackCards).values({ text: "b?", pack: "Base", active: true, pick: 1 });
    // Unrelated pack must be unaffected
    await db.insert(whiteCards).values({ text: "other", pack: "Other", active: true });

    const handler = (await import("~/server/api/admin/cards/toggle-pack.post")).default;
    await handler(mockEvent({ pack: "Base", type: "all", active: false }));

    const whiteRows = await db.select().from(whiteCards);
    const blackRows = await db.select().from(blackCards);
    expect(whiteRows.find((r) => r.pack === "Base")!.active).toBe(false);
    expect(blackRows.find((r) => r.pack === "Base")!.active).toBe(false);
    expect(whiteRows.find((r) => r.pack === "Other")!.active).toBe(true);
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
    await db.insert(whiteCards).values([
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
});
