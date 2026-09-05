import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useDb } from "~/server/db/client";
import { users, lobbies, players, whiteCards, blackCards } from "~/server/db/schema";

const db = useDb();
let currentUserId: string;

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return {
    ...actual,
    requireHost: async (_event: unknown, lobbyId: string) => {
      const { eq } = await import("drizzle-orm");
      const [lobby] = await useDb().select().from(lobbies).where(eq(lobbies.id, lobbyId));
      if (lobby?.hostUserId !== currentUserId) {
        throw createError({ statusCode: 403, statusMessage: "not host" });
      }
      return currentUserId;
    },
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

beforeEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
  await db.delete(whiteCards);
  await db.delete(blackCards);

  const [host] = await db.insert(users).values({ name: "Host" }).returning();
  currentUserId = host.id;
});

afterEach(async () => {
  // Guard against leaking a lobby/player/user into other test files that
  // share this database (run with --no-file-parallelism).
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
});

describe("POST /api/game/start", () => {
  it("rejects a non-host caller", async () => {
    const [lobby] = await db.insert(lobbies).values({ code: "GAME", hostUserId: currentUserId }).returning();
    const [notHost] = await db.insert(users).values({ name: "NotHost" }).returning();
    currentUserId = notHost.id;

    const handler = (await import("~/server/api/game/start.post")).default;
    await expect(
      handler(mockEvent({ lobbyId: lobby.id, settings: {} })),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("deals hands and marks the lobby playing for a valid host", async () => {
    const [lobby] = await db.insert(lobbies).values({ code: "GAME", hostUserId: currentUserId }).returning();
    await db.insert(players).values({
      userId: currentUserId,
      lobbyId: lobby.id,
      name: "Host",
      isHost: true,
    });
    const [other] = await db.insert(users).values({ name: "Player2" }).returning();
    await db.insert(players).values({
      userId: other.id,
      lobbyId: lobby.id,
      name: "Player2",
      isHost: false,
    });
    await db.insert(whiteCards).values(
      Array.from({ length: 40 }, (_, i) => ({ text: `White ${i}`, pack: "Base", active: true })),
    );
    await db.insert(blackCards).values({ text: "Black?", pack: "Base", active: true, pick: 1 });

    const handler = (await import("~/server/api/game/start.post")).default;
    const result = await handler(
      mockEvent({ lobbyId: lobby.id, settings: { cardPacks: ["Base"] } }),
    );

    expect(result.judgeId).toBe(currentUserId); // judgeId is always the host per the ported logic
    expect(Object.keys(result.hands)).toContain(currentUserId);
    expect(Object.keys(result.hands)).toContain(other.id);
  });

  it("omits card texts from the payload entirely", async () => {
    const [lobby] = await db.insert(lobbies).values({ code: "TEXT", hostUserId: currentUserId }).returning();
    await db.insert(players).values({
      userId: currentUserId,
      lobbyId: lobby.id,
      name: "Host",
      isHost: true,
    });
    const [other] = await db.insert(users).values({ name: "Player2" }).returning();
    await db.insert(players).values({
      userId: other.id,
      lobbyId: lobby.id,
      name: "Player2",
      isHost: false,
    });
    await db.insert(whiteCards).values(
      Array.from({ length: 40 }, (_, i) => ({ text: `White ${i}`, pack: "Base", active: true })),
    );
    await db.insert(blackCards).values({ text: "Black?", pack: "Base", active: true, pick: 1 });

    const handler = (await import("~/server/api/game/start.post")).default;
    const result = await handler(
      mockEvent({ lobbyId: lobby.id, settings: { cardPacks: ["Base"] } }),
    );

    // Every text — white and black — is resolved on demand by the client via
    // /api/cards/resolve, so none of it belongs in the Y.Doc payload.
    const whiteIds = [...Object.values(result.hands).flat(), ...result.whiteDeck];
    expect(whiteIds.length).toBeGreaterThan(0);
    for (const id of whiteIds) {
      expect(result.cardTexts[id as string]).toBeUndefined();
    }
    expect(result.cardTexts[result.blackCard.id]).toBeUndefined();
  });

  it("returns black pick counts instead of black card texts", async () => {
    const [lobby] = await db.insert(lobbies).values({ code: "PICK", hostUserId: currentUserId }).returning();
    await db.insert(players).values({
      userId: currentUserId,
      lobbyId: lobby.id,
      name: "Host",
      isHost: true,
    });
    const [other] = await db.insert(users).values({ name: "Player2" }).returning();
    await db.insert(players).values({
      userId: other.id,
      lobbyId: lobby.id,
      name: "Player2",
      isHost: false,
    });
    await db.insert(whiteCards).values(
      Array.from({ length: 40 }, (_, i) => ({ text: `White ${i}`, pack: "Base", active: true })),
    );
    await db.insert(blackCards).values([
      { text: "One blank _?", pack: "Base", active: true, pick: 1 },
      { text: "Two blanks _ and _?", pack: "Base", active: true, pick: 2 },
    ]);

    const handler = (await import("~/server/api/game/start.post")).default;
    const result = await handler(
      mockEvent({ lobbyId: lobby.id, settings: { cardPacks: ["Base"] } }),
    );

    // nextRound only needs `pick` synchronously — the eligibility loop reads it
    // for candidates it may skip. Text is resolved per client instead, so the
    // whole black catalogue's text no longer rides in the Y.Doc.
    const allBlackIds = [result.blackCard.id, ...result.blackDeck];
    for (const id of allBlackIds) {
      expect(typeof result.blackPicks[id as string]).toBe("number");
    }
    expect(Object.values(result.blackPicks).sort()).toEqual([1, 2]);
    expect(result.cardTexts).toEqual({});
    expect(result.blackCard).not.toHaveProperty("text");
  });

  it("rejects starting with fewer than 2 players", async () => {
    const [lobby] = await db.insert(lobbies).values({ code: "SOLO", hostUserId: currentUserId }).returning();
    await db.insert(players).values({
      userId: currentUserId,
      lobbyId: lobby.id,
      name: "Host",
      isHost: true,
    });

    const handler = (await import("~/server/api/game/start.post")).default;
    await expect(
      handler(mockEvent({ lobbyId: lobby.id, settings: {} })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("POST /api/game/draw-cards", () => {
  it("rejects a caller who is not a player in the lobby", async () => {
    const [lobby] = await db.insert(lobbies).values({ code: "DRAW", hostUserId: currentUserId }).returning();
    const [notPlayer] = await db.insert(users).values({ name: "Outsider" }).returning();
    currentUserId = notPlayer.id;

    const handler = (await import("~/server/api/game/draw-cards.post")).default;
    await expect(
      handler(mockEvent({ lobbyId: lobby.id, excludeIds: [], count: 5 })),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns fresh cards excluding already-used ids", async () => {
    const [lobby] = await db.insert(lobbies).values({ code: "DRAW2", hostUserId: currentUserId }).returning();
    await db.insert(players).values({ userId: currentUserId, lobbyId: lobby.id, name: "Host", isHost: true });
    const inserted = await db
      .insert(whiteCards)
      .values(Array.from({ length: 10 }, (_, i) => ({ text: `W${i}`, active: true })))
      .returning();
    const excludeIds = inserted.slice(0, 5).map((c) => c.id);

    const handler = (await import("~/server/api/game/draw-cards.post")).default;
    const result = await handler(
      mockEvent({ lobbyId: lobby.id, excludeIds, count: 3 }),
    );

    expect(result.success).toBe(true);
    expect(result.cardIds).toHaveLength(3);
    expect(result.cardIds.some((id: string) => excludeIds.includes(id))).toBe(false);
  });
});
