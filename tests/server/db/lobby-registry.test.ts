import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq, and } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, lobbies, players } from "~/server/db/schema";

const db = useDb();
let currentUserId: string;

// Leaving deletes a guest's own account and drops their session cookie.
const clearUserSession = vi.fn(async () => true);
vi.stubGlobal("clearUserSession", clearUserSession);

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return {
    ...actual,
    requireAuth: async () => currentUserId,
    // Stubbed alongside requireAuth because it wraps it: these tests cover
    // registry behaviour, not the guest guard, which has its own suite in
    // lobby-guards.test.ts.
    requireNonGuest: async () => currentUserId,
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
  // Signed in: lobby/create requires it (requireNonGuest), so a real host
  // never starts out as a guest.
  const [user] = await db.insert(users).values({ name: "Host", isGuest: false }).returning();
  currentUserId = user.id;
  clearUserSession.mockClear();
});

afterEach(async () => {
  // Some tests intentionally leave a lobby/player behind (e.g. "joins by
  // code"); clean up so state doesn't leak into other test files sharing
  // this database when run with --no-file-parallelism.
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
});

/** Adds a member to `lobbyId`, joined `secondsAgo` ago. Guests unless `signedIn`. */
async function addMember(
  lobbyId: string,
  name: string,
  {
    playerType = "player",
    secondsAgo = 0,
    signedIn = false,
  }: { playerType?: "player" | "spectator" | "bot"; secondsAgo?: number; signedIn?: boolean } = {},
) {
  const [user] = await db
    .insert(users)
    .values({ name, isGuest: !signedIn })
    .returning();
  await db.insert(players).values({
    userId: user.id,
    lobbyId,
    name,
    playerType,
    joinedAt: new Date(Date.now() - secondsAgo * 1000),
  });
  return user.id;
}

async function hostOf(lobbyId: string) {
  const [lobby] = await db.select().from(lobbies).where(eq(lobbies.id, lobbyId));
  return lobby?.hostUserId;
}

async function userExists(userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId));
  return rows.length > 0;
}

async function createLobby(name = "Test") {
  const create = (await import("~/server/api/lobby/create.post")).default;
  return create(mockEvent({ hostUserId: currentUserId, lobbyName: name }));
}

async function leaveLobby(lobbyId: string) {
  const leave = (await import("~/server/api/lobby/leave.post")).default;
  return leave(mockEvent({ lobbyId }));
}

describe("lobby registry", () => {
  it("creates a lobby and its host player row", async () => {
    const lobby = await createLobby();
    expect(lobby.status).toBe("waiting");
    expect(lobby.code).toHaveLength(4);

    const [player] = await db.select().from(players).where(eq(players.lobbyId, lobby.id));
    expect(player.isHost).toBe(true);
  });

  it("joins by code and creates a player row", async () => {
    const lobby = await createLobby();

    const [joiner] = await db.insert(users).values({ name: "Joiner" }).returning();
    currentUserId = joiner.id;
    const join = (await import("~/server/api/lobby/join.post")).default;
    const result = await join(mockEvent({ code: lobby.code, playerName: "Joiner" }));

    expect(result.player.name).toBe("Joiner");
    expect(result.player.isHost).toBe(false);
  });

  it("deletes the lobby, but not the host's account, when the last human leaves", async () => {
    const lobby = await createLobby();
    const hostId = currentUserId;

    const result = await leaveLobby(lobby.id);

    expect(result.lobbyClosed).toBe(true);
    expect(await hostOf(lobby.id)).toBeUndefined();
    expect(await userExists(hostId)).toBe(true);
    expect(clearUserSession).not.toHaveBeenCalled();
  });

  it("hands the host role to the earliest-joined signed-in player", async () => {
    const lobby = await createLobby();
    const later = await addMember(lobby.id, "Later", { secondsAgo: 10, signedIn: true });
    const earlier = await addMember(lobby.id, "Earlier", { secondsAgo: 60, signedIn: true });

    const result = await leaveLobby(lobby.id);

    // Before, the lobby row kept naming the departed host, so requireHost
    // locked everyone left out of starting the game and managing bots.
    expect(result.newHostUserId).toBe(earlier);
    expect(result.lobbyClosed).toBe(false);
    expect(await hostOf(lobby.id)).toBe(earlier);
    const flags = await db
      .select({ userId: players.userId, isHost: players.isHost })
      .from(players)
      .where(eq(players.lobbyId, lobby.id));
    expect(flags).toEqual(
      expect.arrayContaining([
        { userId: earlier, isHost: true },
        { userId: later, isHost: false },
      ]),
    );
  });

  it("never hands the host role to a guest, however early they joined", async () => {
    const lobby = await createLobby();
    await addMember(lobby.id, "Guest", { secondsAgo: 120 });
    const member = await addMember(lobby.id, "Member", { secondsAgo: 5, signedIn: true });

    const result = await leaveLobby(lobby.id);

    expect(result.newHostUserId).toBe(member);
    expect(await hostOf(lobby.id)).toBe(member);
  });

  it("prefers a seated player over an earlier spectator", async () => {
    const lobby = await createLobby();
    await addMember(lobby.id, "Watcher", {
      playerType: "spectator",
      secondsAgo: 120,
      signedIn: true,
    });
    const player = await addMember(lobby.id, "Player", { secondsAgo: 5, signedIn: true });

    const result = await leaveLobby(lobby.id);

    expect(result.newHostUserId).toBe(player);
  });

  it("closes the lobby when the host leaves and only guests remain", async () => {
    const lobby = await createLobby();
    const guest = await addMember(lobby.id, "Guest", { secondsAgo: 30 });
    const bot = await addMember(lobby.id, "Bot", { playerType: "bot" });

    const result = await leaveLobby(lobby.id);

    expect(result).toMatchObject({ lobbyClosed: true, newHostUserId: null });
    expect(await hostOf(lobby.id)).toBeUndefined();
    // Their guest accounts go with the lobby, as when the last human leaves.
    expect(await userExists(guest)).toBe(false);
    expect(await userExists(bot)).toBe(false);
  });

  it("removes a leaving guest's account and session, leaving the host alone", async () => {
    const lobby = await createLobby();
    const hostId = currentUserId;
    currentUserId = await addMember(lobby.id, "Guest");
    const guestId = currentUserId;

    const result = await leaveLobby(lobby.id);

    expect(result).toMatchObject({ lobbyClosed: false, newHostUserId: null });
    expect(await hostOf(lobby.id)).toBe(hostId);
    expect(await userExists(guestId)).toBe(false);
    expect(clearUserSession).toHaveBeenCalledTimes(1);
  });

  it("keeps a guest's account while another lobby still references it", async () => {
    // Deleting it used to fail on players_user_id_users_id_fk and error the
    // whole leave.
    const first = await createLobby("First");
    currentUserId = await addMember(first.id, "Guest");
    const guestId = currentUserId;
    const [other] = await db.insert(users).values({ name: "Other host", isGuest: false }).returning();
    const [second] = await db
      .insert(lobbies)
      .values({ code: "OTHR", hostUserId: other.id })
      .returning();
    await db.insert(players).values({ userId: guestId, lobbyId: second.id, name: "Guest" });

    await leaveLobby(first.id);

    expect(await userExists(guestId)).toBe(true);
    expect(clearUserSession).not.toHaveBeenCalled();
  });

  it("promote-host rejects a guest as the new host", async () => {
    const lobby = await createLobby();
    const guest = await addMember(lobby.id, "Guest");
    const promote = (await import("~/server/api/lobby/promote-host.post")).default;

    await expect(
      promote(mockEvent({ lobbyId: lobby.id, newHostUserId: guest })),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(await hostOf(lobby.id)).toBe(currentUserId);
  });

  it("never persists a client-supplied playerType of 'bot' via join", async () => {
    const create = (await import("~/server/api/lobby/create.post")).default;
    const lobby = await create(mockEvent({ hostUserId: currentUserId, lobbyName: "Test" }));

    const [joiner] = await db.insert(users).values({ name: "Sneaky" }).returning();
    currentUserId = joiner.id;
    const join = (await import("~/server/api/lobby/join.post")).default;
    const result = await join(
      mockEvent({ code: lobby.code, playerName: "Sneaky", playerType: "bot" }),
    );

    expect(result.player.playerType).toBe("player");
    const [stored] = await db
      .select()
      .from(players)
      .where(and(eq(players.userId, joiner.id), eq(players.lobbyId, lobby.id)));
    expect(stored.playerType).toBe("player");
  });

  it("cleans up a bot's synthetic users row when the last human leaves", async () => {
    const create = (await import("~/server/api/lobby/create.post")).default;
    const lobby = await create(mockEvent({ hostUserId: currentUserId, lobbyName: "Test" }));

    const [botUser] = await db
      .insert(users)
      .values({ name: "Bot1", isGuest: true })
      .returning();
    await db.insert(players).values({
      userId: botUser.id,
      lobbyId: lobby.id,
      name: "Bot1",
      playerType: "bot",
    });

    const leave = (await import("~/server/api/lobby/leave.post")).default;
    await leave(mockEvent({ lobbyId: lobby.id }));

    const remainingLobby = await db.select().from(lobbies).where(eq(lobbies.id, lobby.id));
    expect(remainingLobby).toHaveLength(0);

    const remainingBotUser = await db.select().from(users).where(eq(users.id, botUser.id));
    expect(remainingBotUser).toHaveLength(0);
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

  it("promote-host rejects a newHostUserId who is not a player in the lobby", async () => {
    const create = (await import("~/server/api/lobby/create.post")).default;
    const lobby = await create(mockEvent({ hostUserId: currentUserId, lobbyName: "Test" }));

    // A real user, but never joined this lobby (no player row).
    const [nonMember] = await db.insert(users).values({ name: "NonMember" }).returning();
    const promote = (await import("~/server/api/lobby/promote-host.post")).default;
    await expect(
      promote(mockEvent({ lobbyId: lobby.id, newHostUserId: nonMember.id })),
    ).rejects.toMatchObject({ statusCode: 400 });

    const [unchangedLobby] = await db.select().from(lobbies).where(eq(lobbies.id, lobby.id));
    expect(unchangedLobby.hostUserId).toBe(currentUserId);

    const [hostPlayer] = await db
      .select()
      .from(players)
      .where(and(eq(players.userId, currentUserId), eq(players.lobbyId, lobby.id)));
    expect(hostPlayer.isHost).toBe(true);
  });
});
