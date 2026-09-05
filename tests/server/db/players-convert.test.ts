import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, lobbies, players } from "~/server/db/schema";

const db = useDb();
let currentUserId: string;

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return {
    ...actual,
    requirePlayerInLobby: async (_event: unknown, lobbyId: string) => {
      const { eq, and } = await import("drizzle-orm");
      const [row] = await useDb()
        .select()
        .from(players)
        .where(and(eq(players.userId, currentUserId), eq(players.lobbyId, lobbyId)));
      if (!row) throw createError({ statusCode: 403, statusMessage: "not a player" });
      return currentUserId;
    },
  };
});

function mockEvent(body: unknown) {
  globalThis.readBody = async () => body;
  return {} as any;
}

let lobbyId: string;
let hostId: string;
let spectatorId: string;

beforeEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);

  const [host] = await db.insert(users).values({ name: "Host" }).returning();
  const [spectator] = await db.insert(users).values({ name: "Watcher" }).returning();
  hostId = host.id;
  spectatorId = spectator.id;
  currentUserId = host.id;

  const [lobby] = await db
    .insert(lobbies)
    .values({ code: "CONV", hostUserId: hostId, status: "playing" })
    .returning();
  lobbyId = lobby.id;

  await db.insert(players).values([
    { userId: hostId, lobbyId, name: "Host", isHost: true, playerType: "player" },
    { userId: spectatorId, lobbyId, name: "Watcher", playerType: "spectator" },
  ]);
});

afterEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
});

const readType = async (userId: string) => {
  const [row] = await db
    .select()
    .from(players)
    .where(and(eq(players.userId, userId), eq(players.lobbyId, lobbyId)));
  return row?.playerType;
};

describe("POST /api/players/convert", () => {
  it("lets the host deal in a spectator", async () => {
    const handler = (await import("~/server/api/players/convert.post")).default;
    await handler(mockEvent({ lobbyId, playerId: spectatorId }));

    expect(await readType(spectatorId)).toBe("player");
  });

  it("lets a spectator convert themselves", async () => {
    currentUserId = spectatorId;

    const handler = (await import("~/server/api/players/convert.post")).default;
    await handler(mockEvent({ lobbyId, playerId: spectatorId }));

    expect(await readType(spectatorId)).toBe("player");
  });

  it("rejects converting someone else when you are not the host", async () => {
    const [other] = await db.insert(users).values({ name: "Other" }).returning();
    await db.insert(players).values({
      userId: other.id,
      lobbyId,
      name: "Other",
      playerType: "spectator",
    });
    currentUserId = other.id;

    const handler = (await import("~/server/api/players/convert.post")).default;
    await expect(
      handler(mockEvent({ lobbyId, playerId: spectatorId })),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(await readType(spectatorId)).toBe("spectator");
  });

  it("rejects a caller who is not in the lobby at all", async () => {
    const [outsider] = await db.insert(users).values({ name: "Outsider" }).returning();
    currentUserId = outsider.id;

    const handler = (await import("~/server/api/players/convert.post")).default;
    await expect(
      handler(mockEvent({ lobbyId, playerId: spectatorId })),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("leaves a row that is already a player untouched", async () => {
    const handler = (await import("~/server/api/players/convert.post")).default;
    await handler(mockEvent({ lobbyId, playerId: hostId }));

    expect(await readType(hostId)).toBe("player");
  });
});
