import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, players } from "~/server/db/schema";

const db = useDb();

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return { ...actual, requireAdmin: async () => "admin-id" };
});

function mockEvent(body?: unknown) {
  globalThis.readBody = async () => body;
  return {} as any;
}

beforeEach(async () => {
  await db.delete(players);
  await db.delete(users);
});

describe("admin users", () => {
  it("lists registered users and excludes guests", async () => {
    await db.insert(users).values([
      { name: "Registered A", isGuest: false },
      { name: "Registered B", isGuest: false },
      { name: "Guest C", isGuest: true },
    ]);
    const handler = (await import("~/server/api/admin/users/index")).default;
    const result = await handler({} as any);
    expect(result).toHaveLength(2);
    expect(result.every((u: any) => !u.isGuest)).toBe(true);
  });

  it("deletes a user", async () => {
    const [user] = await db
      .insert(users)
      .values({ name: "Deleteme", isGuest: false })
      .returning();
    const handler = (await import("~/server/api/admin/users/delete")).default;
    await handler(mockEvent({ userId: user.id }));

    const remaining = await db.select().from(users).where(eq(users.id, user.id));
    expect(remaining).toHaveLength(0);
  });
});

