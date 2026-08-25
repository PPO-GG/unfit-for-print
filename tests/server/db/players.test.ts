// tests/server/db/players.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, lobbies, players } from "~/server/db/schema";

const db = useDb();
let currentUserId: string;

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return { ...actual, requireAuth: async () => currentUserId };
});

function mockEvent(query: Record<string, string> = {}, params: Record<string, string> = {}, body?: unknown) {
  globalThis.getQuery = () => query;
  globalThis.getRouterParam = (_e: unknown, name: string) => params[name];
  globalThis.readBody = async () => body;
  return {} as any;
}

beforeEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
  const [user] = await db.insert(users).values({ name: "P1" }).returning();
  currentUserId = user.id;
});

describe("players routes", () => {
  it("lists players for a lobby", async () => {
    const [host] = await db.insert(users).values({ name: "Host" }).returning();
    const [lobby] = await db.insert(lobbies).values({ code: "ZZZZ", hostUserId: host.id }).returning();
    await db.insert(players).values({ userId: host.id, lobbyId: lobby.id, name: "Host", isHost: true });

    const handler = (await import("~/server/api/players/list.get")).default;
    const result = await handler(mockEvent({ lobbyId: lobby.id }));
    expect(result).toHaveLength(1);
  });

  it("updates a player's avatar", async () => {
    const [lobby] = await db.insert(lobbies).values({ code: "YYYY", hostUserId: currentUserId }).returning();
    const [player] = await db
      .insert(players)
      .values({ userId: currentUserId, lobbyId: lobby.id, name: "P1" })
      .returning();

    const handler = (await import("~/server/api/players/avatar.post")).default;
    await handler(mockEvent({}, {}, { playerId: player.id, avatarUrl: "https://example.com/a.png" }));

    const [updated] = await db.select().from(players).where(eq(players.id, player.id));
    expect(updated.avatar).toBe("https://example.com/a.png");
  });
});
