import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, blackCards, players } from "~/server/db/schema";

const db = useDb();
let adminId: string;

vi.mock("~/server/utils/session", () => ({
  requireAdmin: async () => adminId,
}));

beforeEach(async () => {
  await db.delete(blackCards);
  await db.delete(players);
  await db.delete(users);
  const [admin] = await db.insert(users).values({ name: "Admin", isAdmin: true }).returning();
  adminId = admin.id;
});

function mockEvent(body: unknown) {
  globalThis.readBody = async () => body;
  return {} as any;
}

const handler = async (body: unknown) =>
  (await import("~/server/api/admin/cards/set-pick.post")).default(mockEvent(body));

describe("admin set-pick", () => {
  it("sets the pick on every listed black card and no others", async () => {
    const [a, b, c] = await db
      .insert(blackCards)
      .values([
        { text: "___ and ___.", pick: 1 },
        { text: "___ or ___?", pick: 1 },
        { text: "Leave me ___.", pick: 1 },
      ])
      .returning();

    const result = await handler({ ids: [a.id, b.id], pick: 2 });
    expect(result.updated).toBe(2);

    const changed = await db.select().from(blackCards).where(inArray(blackCards.id, [a.id, b.id]));
    expect(changed.map((r) => r.pick)).toEqual([2, 2]);
    const [untouched] = await db.select().from(blackCards).where(eq(blackCards.id, c.id));
    expect(untouched.pick).toBe(1);
  });

  it.each([0, 4, 1.5, "2"])("rejects pick %s", async (pick) => {
    const [card] = await db.insert(blackCards).values({ text: "x", pick: 1 }).returning();
    await expect(handler({ ids: [card.id], pick })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an empty id list", async () => {
    await expect(handler({ ids: [], pick: 2 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects more ids than one request may change", async () => {
    const ids = Array.from({ length: 1001 }, () => "00000000-0000-0000-0000-000000000000");
    await expect(handler({ ids, pick: 2 })).rejects.toMatchObject({ statusCode: 400 });
  });
});
