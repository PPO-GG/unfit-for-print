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

function mockEvent(body: unknown, headers: Record<string, string> = {}) {
  globalThis.readBody = async () => body;
  return { node: { req: { headers } } } as any;
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

async function join(code: string, name: string, headers: Record<string, string> = {}) {
  const { default: handler } = await import("~/server/api/lobby/join.post");
  return handler(mockEvent({ code, playerName: name }, headers));
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
    expect(stats).toMatchObject({ windowHours: 24, lobbiesCreated: 2, uniquePlayers: 2 });
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

  it("splits players and lobbies by where the request came from", async () => {
    currentUserId = await newUser("Host");
    const lobby = await createLobby();
    currentUserId = await newUser("Activity guest", true);
    await join(lobby.code, "Activity guest", { authorization: "Bearer token" });

    const stats = await getActivityStats();
    expect(stats.lobbiesBySource).toEqual({ web: 1, discord: 0, unknown: 0 });
    expect(stats.playersBySource).toEqual({ web: 1, discord: 1, unknown: 0 });
  });

  it("counts rows recorded before the source column as unknown", async () => {
    await db.insert(activityEvents).values({
      kind: "player_joined",
      lobbyId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
    });
    expect((await getActivityStats()).playersBySource).toEqual({ web: 0, discord: 0, unknown: 1 });
  });

  it("records a lobby created with a Discord instance as discord", async () => {
    currentUserId = await newUser("Host");
    const { default: handler } = await import("~/server/api/lobby/create.post");
    await handler(mockEvent({ lobbyName: "Activity", discordInstanceId: "i-1" }));
    const rows = await db.select().from(activityEvents);
    expect(rows.map((r) => r.source)).toEqual(["discord", "discord"]);
  });
});
