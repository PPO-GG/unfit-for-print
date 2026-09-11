import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useDb } from "~/server/db/client";
import { users, lobbies, players, userStats } from "~/server/db/schema";

const db = useDb();
let currentUserId: string;

// The guard has its own suite (lobby-guards.test.ts). This mock keeps its
// contract — 403 for a guest — so what's under test is that the route uses it.
vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return {
    ...actual,
    requireNonGuest: async () => {
      const { eq } = await import("drizzle-orm");
      const [u] = await useDb()
        .select({ isGuest: users.isGuest })
        .from(users)
        .where(eq(users.id, currentUserId));
      if (!u || u.isGuest)
        throw createError({
          statusCode: 403,
          statusMessage: "Forbidden: sign in to do this",
        });
      return currentUserId;
    },
  };
});

const handler = async () =>
  (await import("~/server/api/stats/me.get")).default;

const discordUser = async (name: string) => {
  const [u] = await db
    .insert(users)
    .values({ name, isGuest: false, discordUserId: `discord-${name}` })
    .returning();
  return u!.id;
};

const clear = async () => {
  await db.delete(userStats);
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
};

beforeEach(clear);
afterEach(clear);

describe("GET /api/stats/me", () => {
  it("rejects a guest", async () => {
    const [guest] = await db.insert(users).values({ name: "Guest" }).returning();
    currentUserId = guest!.id;

    await expect((await handler())({} as any)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("returns zeros for a Discord user who has not played", async () => {
    currentUserId = await discordUser("Fresh");

    expect(await (await handler())({} as any)).toEqual({
      gamesPlayed: 0,
      gamesWon: 0,
      roundsPlayed: 0,
      roundsWon: 0,
      roundsJudged: 0,
    });
  });

  it("returns the caller's own counters and nobody else's", async () => {
    const me = await discordUser("Me");
    const other = await discordUser("Other");
    await db.insert(userStats).values([
      { userId: me, gamesPlayed: 3, gamesWon: 1, roundsPlayed: 20, roundsWon: 6, roundsJudged: 5 },
      { userId: other, gamesPlayed: 9, gamesWon: 9, roundsPlayed: 99, roundsWon: 99, roundsJudged: 9 },
    ]);
    currentUserId = me;

    expect(await (await handler())({} as any)).toEqual({
      gamesPlayed: 3,
      gamesWon: 1,
      roundsPlayed: 20,
      roundsWon: 6,
      roundsJudged: 5,
    });
  });
});
