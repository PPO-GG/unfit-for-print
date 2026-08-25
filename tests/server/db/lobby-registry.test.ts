import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, lobbies, players } from "~/server/db/schema";

const db = useDb();
let currentUserId: string;

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return {
    ...actual,
    requireAuth: async () => currentUserId,
    requirePlayerInLobby: async (_event: unknown, lobbyId: string) => {
      const [row] = await useDb()
        .select()
        .from(players)
        .where((await import("drizzle-orm")).and(
          (await import("drizzle-orm")).eq(players.userId, currentUserId),
          (await import("drizzle-orm")).eq(players.lobbyId, lobbyId),
        ));
      if (!row) throw createError({ statusCode: 403, statusMessage: "not a player" });
      return currentUserId;
    },
    requireHost: async (event: unknown, lobbyId: string) => {
      const [lobby] = await useDb().select().from(lobbies).where(eq(lobbies.id, lobbyId));
      if (lobby?.hostUserId !== currentUserId) {
        throw createError({ statusCode: 403, statusMessage: "not host" });
      }
      return currentUserId;
    },
  };
});

function mockEvent(body: unknown, params: Record<string, string> = {}) {
  globalThis.readBody = async () => body;
  globalThis.getRouterParam = (_e: unknown, name: string) => params[name];
  globalThis.getQuery = () => params;
  return {} as any;
}

beforeEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
  const [user] = await db.insert(users).values({ name: "Host" }).returning();
  currentUserId = user.id;
});

afterEach(async () => {
  // Some tests intentionally leave a lobby/player behind (e.g. "joins by
  // code"); clean up so state doesn't leak into other test files sharing
  // this database when run with --no-file-parallelism.
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
});

describe("lobby registry", () => {
  it("creates a lobby and its host player row", async () => {
    const create = (await import("~/server/api/lobby/create.post")).default;
    const lobby = await create(mockEvent({ hostUserId: currentUserId, lobbyName: "Test" }));
    expect(lobby.status).toBe("waiting");
    expect(lobby.code).toHaveLength(4);

    const [player] = await db.select().from(players).where(eq(players.lobbyId, lobby.id));
    expect(player.isHost).toBe(true);
  });

  it("joins by code and creates a player row", async () => {
    const create = (await import("~/server/api/lobby/create.post")).default;
    const lobby = await create(mockEvent({ hostUserId: currentUserId, lobbyName: "Test" }));

    const [joiner] = await db.insert(users).values({ name: "Joiner" }).returning();
    currentUserId = joiner.id;
    const join = (await import("~/server/api/lobby/join.post")).default;
    const result = await join(mockEvent({ code: lobby.code, playerName: "Joiner" }));

    expect(result.player.name).toBe("Joiner");
    expect(result.player.isHost).toBe(false);
  });

  it("deletes the lobby when the last human leaves", async () => {
    const create = (await import("~/server/api/lobby/create.post")).default;
    const lobby = await create(mockEvent({ hostUserId: currentUserId, lobbyName: "Test" }));

    const leave = (await import("~/server/api/lobby/leave.post")).default;
    await leave(mockEvent({ lobbyId: lobby.id }));

    const remaining = await db.select().from(lobbies).where(eq(lobbies.id, lobby.id));
    expect(remaining).toHaveLength(0);
  });

  it("promote-host rejects a non-host caller", async () => {
    const create = (await import("~/server/api/lobby/create.post")).default;
    const lobby = await create(mockEvent({ hostUserId: currentUserId, lobbyName: "Test" }));

    const [other] = await db.insert(users).values({ name: "Other" }).returning();
    currentUserId = other.id;
    const promote = (await import("~/server/api/lobby/promote-host.post")).default;
    await expect(
      promote(mockEvent({ lobbyId: lobby.id, newHostUserId: other.id })),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
