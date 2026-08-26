// tests/server/db/bots.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, players, users } from "~/server/db/schema";

const db = useDb();
let currentUserId: string;

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return {
    ...actual,
    requireHost: async (_event: unknown, lobbyId: string) => {
      const [lobby] = await useDb().select().from(lobbies).where(eq(lobbies.id, lobbyId));
      if (lobby?.hostUserId !== currentUserId) {
        throw createError({ statusCode: 403, statusMessage: "not host" });
      }
      return currentUserId;
    },
  };
});

function mockEvent(body?: unknown) {
  globalThis.readBody = async () => body;
  return {} as any;
}

beforeEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
  const [host] = await db.insert(users).values({ name: "Host" }).returning();
  currentUserId = host.id;
});

afterEach(async () => {
  // Guard against leaking a lobby/user into other test files that share
  // this database (run with --no-file-parallelism) if a test fails
  // partway through.
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
});

describe("bot routes", () => {
  it("add creates a synthetic users row and a bot player row", async () => {
    const [lobby] = await db
      .insert(lobbies)
      .values({ code: "BOT1", hostUserId: currentUserId })
      .returning();
    await db
      .insert(players)
      .values({ userId: currentUserId, lobbyId: lobby.id, name: "Host", isHost: true });

    const handler = (await import("~/server/api/bot/add.post")).default;
    const result: any = await handler(mockEvent({ lobbyId: lobby.id }));

    expect(result.success).toBe(true);
    expect(result.bot.playerType).toBe("bot");

    const [botUser] = await db.select().from(users).where(eq(users.id, result.bot.userId));
    expect(botUser).toMatchObject({ isGuest: true, discordUserId: null });

    const [botPlayer] = await db
      .select()
      .from(players)
      .where(and(eq(players.userId, result.bot.userId), eq(players.lobbyId, lobby.id)));
    expect(botPlayer.playerType).toBe("bot");
  });

  it("remove deletes both the bot's player row and its synthetic users row", async () => {
    const [lobby] = await db
      .insert(lobbies)
      .values({ code: "BOT2", hostUserId: currentUserId })
      .returning();
    await db
      .insert(players)
      .values({ userId: currentUserId, lobbyId: lobby.id, name: "Host", isHost: true });

    const add = (await import("~/server/api/bot/add.post")).default;
    const added: any = await add(mockEvent({ lobbyId: lobby.id }));

    const remove = (await import("~/server/api/bot/remove.post")).default;
    await remove(mockEvent({ lobbyId: lobby.id, botUserId: added.bot.userId }));

    const remainingPlayer = await db
      .select()
      .from(players)
      .where(eq(players.userId, added.bot.userId));
    expect(remainingPlayer).toHaveLength(0);

    const remainingUser = await db.select().from(users).where(eq(users.id, added.bot.userId));
    expect(remainingUser).toHaveLength(0);
  });

  it("remove's synthetic-row guard refuses to delete a real user's account", async () => {
    const [lobby] = await db
      .insert(lobbies)
      .values({ code: "BOT3", hostUserId: currentUserId })
      .returning();
    await db
      .insert(players)
      .values({ userId: currentUserId, lobbyId: lobby.id, name: "Host", isHost: true });

    // Simulate the bug this guard defends against: a real, non-guest user
    // whose player row was somehow marked playerType='bot'.
    const [realUser] = await db
      .insert(users)
      .values({ name: "RealUser", isGuest: false, discordUserId: "discord-real-1" })
      .returning();
    await db.insert(players).values({
      userId: realUser.id,
      lobbyId: lobby.id,
      name: "RealUser",
      playerType: "bot",
    });

    const remove = (await import("~/server/api/bot/remove.post")).default;
    await remove(mockEvent({ lobbyId: lobby.id, botUserId: realUser.id }));

    // The player row is still removed (it matched the bot query)...
    const remainingPlayer = await db
      .select()
      .from(players)
      .where(eq(players.userId, realUser.id));
    expect(remainingPlayer).toHaveLength(0);

    // ...but the guard must have refused to delete the real account.
    const remainingUser = await db.select().from(users).where(eq(users.id, realUser.id));
    expect(remainingUser).toHaveLength(1);
  });
});
