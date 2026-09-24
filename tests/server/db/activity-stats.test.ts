import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useDb } from "~/server/db/client";
import { activityEvents, lobbies, players, users } from "~/server/db/schema";
import { getActivityStats, pruneActivity } from "~/server/utils/activity";
import { pruneStaleLobbies } from "~/server/utils/pruneLobbies";

const db = useDb();
let currentUserId: string;

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return {
    ...actual,
    requireAuth: async () => currentUserId,
    requireNonGuest: async () => currentUserId,
    requireAdmin: async () => currentUserId,
  };
});

function mockEvent(body: unknown) {
  globalThis.readBody = async () => body;
  return {} as any;
}

async function clean() {
  await db.delete(activityEvents);
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
}

async function newUser(name: string, isGuest = false) {
  const [user] = await db.insert(users).values({ name, isGuest }).returning();
  return user!.id;
}

async function createLobby() {
  const { default: handler } = await import("~/server/api/lobby/create.post");
  return handler(mockEvent({ lobbyName: "Stats" }));
}

async function join(code: string, name: string) {
  const { default: handler } = await import("~/server/api/lobby/join.post");
  return handler(mockEvent({ code, playerName: name }));
}

beforeEach(clean);
afterEach(clean);

describe("activity stats", () => {
  it("counts lobbies created and distinct players, host included", async () => {
    const hostId = await newUser("Host");
    currentUserId = hostId;
    const lobby = await createLobby();
    const second = await createLobby();

    currentUserId = await newUser("Guest", true);
    await join(lobby.code, "Guest");
    // Re-joining a seat you already hold is not a new player.
    await join(lobby.code, "Guest");
    await join(second.code, "Guest");

    const stats = await getActivityStats();
    expect(stats).toEqual({ windowHours: 24, lobbiesCreated: 2, uniquePlayers: 2 });
  });

  it("survives the lobby sweeper deleting the lobby and its players", async () => {
    currentUserId = await newUser("Host");
    const lobby = await createLobby();
    currentUserId = await newUser("Guest", true);
    await join(lobby.code, "Guest");

    await db.update(lobbies).set({ status: "complete", createdAt: new Date(Date.now() - 2 * 3600_000) });
    await pruneStaleLobbies();
    expect(await db.select().from(lobbies)).toHaveLength(0);

    const stats = await getActivityStats();
    expect(stats.lobbiesCreated).toBe(1);
    expect(stats.uniquePlayers).toBe(2);
  });

  it("excludes rows outside the window and prunes rows past retention", async () => {
    const lobbyId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
    await db.insert(activityEvents).values([
      { kind: "lobby_created", lobbyId, userId, createdAt: hoursAgo(25) },
      { kind: "player_joined", lobbyId, userId, createdAt: hoursAgo(25) },
      { kind: "player_joined", lobbyId, userId, createdAt: hoursAgo(31 * 24) },
    ]);

    expect(await getActivityStats()).toMatchObject({ lobbiesCreated: 0, uniquePlayers: 0 });
    expect(await pruneActivity()).toBe(1);
    expect(await db.select().from(activityEvents)).toHaveLength(2);
  });

  it("serves the stats from the admin route", async () => {
    currentUserId = await newUser("Host");
    await createLobby();
    const { default: handler } = await import("~/server/api/admin/stats/activity.get");
    expect(await handler({} as any)).toMatchObject({ lobbiesCreated: 1, uniquePlayers: 1 });
  });
});
