import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import {
  users,
  lobbies,
  players,
  whiteCards,
  blackCards,
} from "~/server/db/schema";

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
        .where(
          and(eq(players.userId, currentUserId), eq(players.lobbyId, lobbyId)),
        );
      if (!row)
        throw createError({ statusCode: 403, statusMessage: "not a player" });
      return currentUserId;
    },
  };
});

function mockEvent(body: unknown) {
  globalThis.readBody = async () => body;
  return {} as any;
}

const handler = async () =>
  (await import("~/server/api/game/record-round.post")).default;

let lobbyId: string;
let hostId: string;
let whiteA: string;
let whiteB: string;
let whiteC: string;
let black: string;

beforeEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
  await db.delete(whiteCards);
  await db.delete(blackCards);

  const [host] = await db.insert(users).values({ name: "Host" }).returning();
  hostId = host.id;
  currentUserId = host.id;

  const [lobby] = await db
    .insert(lobbies)
    .values({ code: "STAT", hostUserId: hostId, status: "playing" })
    .returning();
  lobbyId = lobby.id;

  await db.insert(players).values({
    userId: hostId,
    lobbyId,
    name: "Host",
    isHost: true,
    playerType: "player",
  });

  const white = await db
    .insert(whiteCards)
    .values([
      { text: "card a", pack: "base" },
      { text: "card b", pack: "base" },
      { text: "card c", pack: "base" },
    ])
    .returning();
  whiteA = white[0]!.id;
  whiteB = white[1]!.id;
  whiteC = white[2]!.id;

  const [b] = await db
    .insert(blackCards)
    .values({ text: "prompt _", pack: "base", pick: 1 })
    .returning();
  black = b!.id;
});

afterEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
  await db.delete(whiteCards);
  await db.delete(blackCards);
});

const readWhite = async (id: string) => {
  const [row] = await db
    .select({ played: whiteCards.timesPlayed, won: whiteCards.timesWon })
    .from(whiteCards)
    .where(eq(whiteCards.id, id));
  return row!;
};

const readBlack = async (id: string) => {
  const [row] = await db
    .select({ played: blackCards.timesPlayed })
    .from(blackCards)
    .where(eq(blackCards.id, id));
  return row!;
};

describe("POST /api/game/record-round", () => {
  it("increments times_played for every white card submitted", async () => {
    await (await handler())(
      mockEvent({
        lobbyId,
        blackCardId: black,
        playedWhiteIds: [whiteA, whiteB],
        wonWhiteIds: [],
      }),
    );

    expect((await readWhite(whiteA)).played).toBe(1);
    expect((await readWhite(whiteB)).played).toBe(1);
  });

  it("leaves cards that were not submitted untouched", async () => {
    await (await handler())(
      mockEvent({
        lobbyId,
        blackCardId: black,
        playedWhiteIds: [whiteA],
        wonWhiteIds: [],
      }),
    );

    expect(await readWhite(whiteC)).toEqual({ played: 0, won: 0 });
  });

  it("counts a winning card as both played and won", async () => {
    await (await handler())(
      mockEvent({
        lobbyId,
        blackCardId: black,
        playedWhiteIds: [whiteA, whiteB],
        wonWhiteIds: [whiteB],
      }),
    );

    expect(await readWhite(whiteB)).toEqual({ played: 1, won: 1 });
    expect(await readWhite(whiteA)).toEqual({ played: 1, won: 0 });
  });

  it("increments times_played for the black card", async () => {
    await (await handler())(
      mockEvent({
        lobbyId,
        blackCardId: black,
        playedWhiteIds: [whiteA],
        wonWhiteIds: [whiteA],
      }),
    );

    expect((await readBlack(black)).played).toBe(1);
  });

  it("accumulates across rounds rather than overwriting", async () => {
    const h = await handler();
    for (let i = 0; i < 3; i++) {
      await h(
        mockEvent({
          lobbyId,
          blackCardId: black,
          playedWhiteIds: [whiteA],
          wonWhiteIds: i === 0 ? [whiteA] : [],
        }),
      );
    }

    expect(await readWhite(whiteA)).toEqual({ played: 3, won: 1 });
    expect((await readBlack(black)).played).toBe(3);
  });

  it("counts a duplicated id once per round", async () => {
    await (await handler())(
      mockEvent({
        lobbyId,
        blackCardId: black,
        playedWhiteIds: [whiteA, whiteA],
        wonWhiteIds: [],
      }),
    );

    expect((await readWhite(whiteA)).played).toBe(1);
  });

  it("ignores ids that match no card", async () => {
    await (await handler())(
      mockEvent({
        lobbyId,
        blackCardId: "00000000-0000-0000-0000-000000000000",
        playedWhiteIds: [whiteA, "00000000-0000-0000-0000-000000000001"],
        wonWhiteIds: [],
      }),
    );

    expect((await readWhite(whiteA)).played).toBe(1);
  });

  it("records the white cards even when no black card id is supplied", async () => {
    await (await handler())(
      mockEvent({
        lobbyId,
        blackCardId: null,
        playedWhiteIds: [whiteA],
        wonWhiteIds: [whiteA],
      }),
    );

    expect(await readWhite(whiteA)).toEqual({ played: 1, won: 1 });
  });

  // `nextRound` writes { id: "", text: "No eligible cards remain" } when the
  // black deck is exhausted. That empty string reaches a uuid column, where it
  // is a query error rather than a miss.
  it("ignores the exhausted-deck sentinel as a black card id", async () => {
    await (await handler())(
      mockEvent({
        lobbyId,
        blackCardId: "",
        playedWhiteIds: [whiteA],
        wonWhiteIds: [],
      }),
    );

    expect((await readWhite(whiteA)).played).toBe(1);
  });

  it("ignores malformed card ids without dropping the valid ones", async () => {
    await (await handler())(
      mockEvent({
        lobbyId,
        blackCardId: black,
        playedWhiteIds: [whiteA, "not-a-uuid", ""],
        wonWhiteIds: [],
      }),
    );

    expect((await readWhite(whiteA)).played).toBe(1);
    expect((await readBlack(black)).played).toBe(1);
  });

  it("rejects a caller who is not a player in the lobby", async () => {
    const [outsider] = await db
      .insert(users)
      .values({ name: "Outsider" })
      .returning();
    currentUserId = outsider!.id;

    await expect(
      (await handler())(
        mockEvent({
          lobbyId,
          blackCardId: black,
          playedWhiteIds: [whiteA],
          wonWhiteIds: [],
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect((await readWhite(whiteA)).played).toBe(0);
  });

  it("rejects a body with no lobbyId", async () => {
    await expect(
      (await handler())(
        mockEvent({ blackCardId: black, playedWhiteIds: [whiteA] }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a played list that is not an array", async () => {
    await expect(
      (await handler())(
        mockEvent({ lobbyId, blackCardId: black, playedWhiteIds: "nope" }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an implausibly large round", async () => {
    const ids = Array.from(
      { length: 101 },
      (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    );

    await expect(
      (await handler())(
        mockEvent({
          lobbyId,
          blackCardId: black,
          playedWhiteIds: ids,
          wonWhiteIds: [],
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
