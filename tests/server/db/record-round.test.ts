import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import {
  users,
  lobbies,
  players,
  whiteCards,
  blackCards,
  statRounds,
  userStats,
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
  await db.delete(statRounds);
  await db.delete(userStats);
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
  await db.delete(statRounds);
  await db.delete(userStats);
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

const GAME = "11111111-1111-4111-8111-111111111111";
const OTHER_GAME = "22222222-2222-4222-8222-222222222222";

const zero = {
  gamesPlayed: 0,
  gamesWon: 0,
  roundsPlayed: 0,
  roundsWon: 0,
  roundsJudged: 0,
};

/** Creates a user and seats them in the test lobby. Non-guest by default. */
async function seat(
  name: string,
  opts: { playerType?: "player" | "spectator" | "bot"; isGuest?: boolean } = {},
) {
  const isGuest = opts.isGuest ?? false;
  const [u] = await db
    .insert(users)
    .values({ name, isGuest, discordUserId: isGuest ? null : `discord-${name}` })
    .returning();
  await db.insert(players).values({
    userId: u!.id,
    lobbyId,
    name,
    playerType: opts.playerType ?? "player",
  });
  return u!.id;
}

const readStats = async (userId: string) => {
  const [row] = await db
    .select({
      gamesPlayed: userStats.gamesPlayed,
      gamesWon: userStats.gamesWon,
      roundsPlayed: userStats.roundsPlayed,
      roundsWon: userStats.roundsWon,
      roundsJudged: userStats.roundsJudged,
    })
    .from(userStats)
    .where(eq(userStats.userId, userId));
  return row ?? null;
};

describe("POST /api/game/record-round — player stats", () => {
  let judge: string;
  let alice: string;
  let bob: string;

  beforeEach(async () => {
    judge = await seat("Judge");
    alice = await seat("Alice");
    bob = await seat("Bob");
    currentUserId = judge;
  });

  const roundBody = (over: Record<string, unknown> = {}) => ({
    lobbyId,
    blackCardId: black,
    playedWhiteIds: [whiteA, whiteB],
    wonWhiteIds: [whiteB],
    gameId: GAME,
    round: 1,
    submitterIds: [alice, bob],
    winnerId: bob,
    botJudged: false,
    gameOver: false,
    ...over,
  });

  it("credits submitters, the winner, and the judge", async () => {
    await (await handler())(mockEvent(roundBody()));

    expect(await readStats(alice)).toEqual({ ...zero, roundsPlayed: 1 });
    expect(await readStats(bob)).toEqual({ ...zero, roundsPlayed: 1, roundsWon: 1 });
    expect(await readStats(judge)).toEqual({ ...zero, roundsJudged: 1 });
  });

  it("counts a replayed (gameId, round) once, card counters included", async () => {
    const h = await handler();
    await h(mockEvent(roundBody()));
    const second = await h(mockEvent(roundBody()));

    expect(second).toEqual({ success: true, duplicate: true });
    expect((await readStats(bob))!.roundsWon).toBe(1);
    expect(await readWhite(whiteB)).toEqual({ played: 1, won: 1 });
  });

  it("counts the next round of the same game", async () => {
    const h = await handler();
    await h(mockEvent(roundBody()));
    await h(mockEvent(roundBody({ round: 2 })));

    expect((await readStats(bob))!.roundsWon).toBe(2);
  });

  it("counts round 1 of a different game", async () => {
    const h = await handler();
    await h(mockEvent(roundBody()));
    await h(mockEvent(roundBody({ gameId: OTHER_GAME })));

    expect((await readStats(bob))!.roundsWon).toBe(2);
  });

  it("credits only non-guest players seated in the lobby", async () => {
    const guest = await seat("Guest", { isGuest: true });
    const bot = await seat("Bot", { playerType: "bot", isGuest: true });
    const spectator = await seat("Spec", { playerType: "spectator" });
    const [outsider] = await db
      .insert(users)
      .values({ name: "Outsider", isGuest: false, discordUserId: "discord-out" })
      .returning();

    await (await handler())(
      mockEvent(
        roundBody({
          submitterIds: [alice, guest, bot, spectator, outsider!.id],
          winnerId: guest,
        }),
      ),
    );

    expect(await readStats(alice)).toEqual({ ...zero, roundsPlayed: 1 });
    expect(await readStats(guest)).toBeNull();
    expect(await readStats(bot)).toBeNull();
    expect(await readStats(spectator)).toBeNull();
    expect(await readStats(outsider!.id)).toBeNull();
  });

  it("rejects a winner who did not submit, and writes nothing", async () => {
    await expect(
      (await handler())(mockEvent(roundBody({ winnerId: judge }))),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(await db.select().from(statRounds)).toHaveLength(0);
    expect(await readStats(judge)).toBeNull();
    expect((await readWhite(whiteA)).played).toBe(0);
  });

  it("a bot-judged round credits the humans but no judge and no cards", async () => {
    await (await handler())(mockEvent(roundBody({ botJudged: true })));

    expect(await readStats(judge)).toBeNull();
    expect(await readStats(bob)).toEqual({ ...zero, roundsPlayed: 1, roundsWon: 1 });
    expect(await readWhite(whiteA)).toEqual({ played: 0, won: 0 });
    expect((await readBlack(black)).played).toBe(0);
  });

  it("on game over, credits participants a game and the winner a win", async () => {
    await (await handler())(
      mockEvent(roundBody({ gameOver: true, participantIds: [judge, alice, bob] })),
    );

    expect(await readStats(judge)).toEqual({ ...zero, gamesPlayed: 1, roundsJudged: 1 });
    expect(await readStats(alice)).toEqual({ ...zero, gamesPlayed: 1, roundsPlayed: 1 });
    expect(await readStats(bob)).toEqual({
      gamesPlayed: 1,
      gamesWon: 1,
      roundsPlayed: 1,
      roundsWon: 1,
      roundsJudged: 0,
    });
  });

  it("credits humans a game even when only bots submitted the final round", async () => {
    const bot = await seat("Bot", { playerType: "bot", isGuest: true });

    await (await handler())(
      mockEvent(
        roundBody({
          playedWhiteIds: [],
          wonWhiteIds: [],
          submitterIds: [],
          winnerId: null,
          gameOver: true,
          participantIds: [judge, alice, bot],
        }),
      ),
    );

    expect(await readStats(judge)).toEqual({ ...zero, gamesPlayed: 1, roundsJudged: 1 });
    expect(await readStats(alice)).toEqual({ ...zero, gamesPlayed: 1 });
    expect(await readStats(bot)).toBeNull();
  });

  it("without a gameId, updates card counters only", async () => {
    await (await handler())(
      mockEvent(roundBody({ gameId: undefined, round: undefined })),
    );

    expect((await readWhite(whiteA)).played).toBe(1);
    expect(await db.select().from(userStats)).toHaveLength(0);
    expect(await db.select().from(statRounds)).toHaveLength(0);
  });

  it("treats a non-integer round as untracked", async () => {
    await (await handler())(mockEvent(roundBody({ round: 1.5 })));

    expect(await db.select().from(userStats)).toHaveLength(0);
  });
});
