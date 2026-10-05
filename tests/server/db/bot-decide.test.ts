import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { blackCards, lobbies, players, users, whiteCards } from "~/server/db/schema";
import { __resetRateLimits, consumeRateLimit } from "~/server/utils/rateLimit";
import { insertCards, resetCardTables } from "./helpers/cards";

const db = useDb();
let currentUserId: string;

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return {
    ...actual,
    requirePlayerInLobby: async (_event: unknown, lobbyId: string) => {
      const { and, eq } = await import("drizzle-orm");
      const [row] = await useDb()
        .select()
        .from(players)
        .where(and(eq(players.userId, currentUserId), eq(players.lobbyId, lobbyId)));
      if (!row) throw createError({ statusCode: 403, statusMessage: "not a player" });
      return currentUserId;
    },
  };
});

// `.env` carries a real TYPESAFE_API_KEY, so the real client must never run
// here: the module is mocked, and fetch throws if anything slips past it.
const jevChoose = vi.fn();
let configured = true;
vi.mock("~/server/utils/jev", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/jev")>();
  return {
    ...actual,
    jevChoose: (...args: unknown[]) => jevChoose(...args),
    jevConfigured: () => configured,
  };
});
vi.stubGlobal("fetch", () => {
  throw new Error("bot-decide tests must not reach the network");
});
vi.stubGlobal("setResponseHeader", () => {});

function mockEvent(body: unknown) {
  globalThis.readBody = async () => body;
  return {} as any;
}

const handler = async () => (await import("~/server/api/bot/decide.post")).default;
const decide = async (body: Record<string, unknown>) =>
  (await handler())(mockEvent({ botUserId: botId, ...body }));

/** Jev stand-in that puts all probability on one criteria key. */
const prefer = (key: (criteria: Record<string, string>) => string) =>
  jevChoose.mockImplementation(
    async (_state: string, _instructions: string, criteria: Record<string, string>) => ({
      [key(criteria)]: 1,
    }),
  );
const first = (criteria: Record<string, string>) => Object.keys(criteria)[0]!;

let lobbyId: string;
let botId: string;
let hand: string[];

async function blackCard(text: string, pick: number) {
  const [row] = await insertCards(blackCards, { text, pick });
  return row!.id;
}

async function addBot(name: string, inLobby = lobbyId) {
  const [user] = await db.insert(users).values({ name }).returning();
  await db.insert(players).values({
    userId: user!.id,
    lobbyId: inLobby,
    name,
    isHost: false,
    playerType: "bot",
  });
  return user!.id;
}

beforeEach(async () => {
  __resetRateLimits();
  jevChoose.mockReset();
  configured = true;

  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
  await resetCardTables();

  const [host] = await db.insert(users).values({ name: "Host" }).returning();
  currentUserId = host!.id;
  const [lobby] = await db
    .insert(lobbies)
    .values({ code: "BOTS", hostUserId: host!.id, status: "playing" })
    .returning();
  lobbyId = lobby!.id;
  await db.insert(players).values({
    userId: host!.id,
    lobbyId,
    name: "Host",
    isHost: true,
    playerType: "player",
  });
  // The route only answers for lobbies that actually hold a bot.
  const [botUser] = await db.insert(users).values({ name: "Bot" }).returning();
  botId = botUser!.id;
  await db.insert(players).values({
    userId: botUser!.id,
    lobbyId,
    name: "Bot",
    isHost: false,
    playerType: "bot",
  });

  const white = await insertCards(whiteCards, [
    { text: "Alpha." },
    { text: "Bravo." },
    { text: "Charlie." },
    { text: "Delta." },
    { text: "Echo." },
  ]);
  hand = white.map((w) => w.id);
});

afterEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
  await resetCardTables();
});

describe("POST /api/bot/decide — play", () => {
  it("returns the one card Jev prefers for a one-card prompt", async () => {
    const black = await blackCard("Why _?", 1);
    prefer(() => "c2");

    const res = await decide({ lobbyId, mode: "play", blackCardId: black, hand });

    expect(res).toEqual({ cardIds: [hand[2]] });
    expect(jevChoose).toHaveBeenCalledTimes(1);
    const [state, , criteria] = jevChoose.mock.calls[0]!;
    expect(state).toBe("Prompt card: Why _?");
    expect(criteria).toEqual({
      c0: "Why [Alpha]?",
      c1: "Why [Bravo]?",
      c2: "Why [Charlie]?",
      c3: "Why [Delta]?",
      c4: "Why [Echo]?",
    });
  });

  it("fills a three-card prompt one card at a time without repeats", async () => {
    const black = await blackCard("_, _ and _.", 3);
    prefer(first);

    const res = await decide({ lobbyId, mode: "play", blackCardId: black, hand });

    expect(res).toEqual({ cardIds: [hand[0], hand[1], hand[2]] });
    expect(jevChoose).toHaveBeenCalledTimes(3);
    const sizes = jevChoose.mock.calls.map((c) => Object.keys(c[2]).length);
    expect(sizes).toEqual([5, 4, 3]);
    expect(jevChoose.mock.calls[2]![2].c0).toBe("[Alpha], [Bravo] and [Charlie].");
    expect(jevChoose.mock.calls[0]![1]).toMatch(/card 1 of 3/);
  });

  it("returns only as many cards as the hand holds", async () => {
    const black = await blackCard("_, _ and _.", 3);
    prefer(first);

    const res = await decide({
      lobbyId,
      mode: "play",
      blackCardId: black,
      hand: hand.slice(0, 2),
    });

    expect(res).toEqual({ cardIds: [hand[0], hand[1]] });
  });

  it("returns null without asking Jev when no key is configured", async () => {
    configured = false;
    const black = await blackCard("Why _?", 1);

    expect(await decide({ lobbyId, mode: "play", blackCardId: black, hand })).toEqual({
      cardIds: null,
    });
    expect(jevChoose).not.toHaveBeenCalled();
  });

  it("returns null when Jev fails partway through a multi-card prompt", async () => {
    const black = await blackCard("_ + _", 2);
    jevChoose
      .mockImplementationOnce(async () => ({ c0: 1 }))
      .mockImplementationOnce(async () => {
        throw new Error("HTTP 503");
      });

    expect(await decide({ lobbyId, mode: "play", blackCardId: black, hand })).toEqual({
      cardIds: null,
    });
  });

  it("returns null when Jev's distribution has nothing pickable", async () => {
    const black = await blackCard("Why _?", 1);
    jevChoose.mockImplementation(async () => ({ unexpected: 1, c0: 0 }));

    expect(await decide({ lobbyId, mode: "play", blackCardId: black, hand })).toEqual({
      cardIds: null,
    });
  });

  it("returns null for an inactive card without asking Jev", async () => {
    const black = await blackCard("Why _?", 1);
    await db.update(whiteCards).set({ active: false }).where(eq(whiteCards.id, hand[0]!));

    expect(await decide({ lobbyId, mode: "play", blackCardId: black, hand })).toEqual({
      cardIds: null,
    });
    expect(jevChoose).not.toHaveBeenCalled();
  });

  it("returns null for an image-only card with no text", async () => {
    const black = await blackCard("Why _?", 1);
    await db.update(whiteCards).set({ text: null }).where(eq(whiteCards.id, hand[1]!));

    expect(await decide({ lobbyId, mode: "play", blackCardId: black, hand })).toEqual({
      cardIds: null,
    });
    expect(jevChoose).not.toHaveBeenCalled();
  });
});

describe("POST /api/bot/decide — judge", () => {
  it("returns the index of the submission Jev prefers", async () => {
    const black = await blackCard("_ + _", 2);
    prefer(() => "s1");

    const res = await decide({
      lobbyId,
      mode: "judge",
      blackCardId: black,
      submissions: [
        [hand[0], hand[1]],
        [hand[2], hand[3]],
      ],
    });

    expect(res).toEqual({ winnerIndex: 1 });
    const [, instructions, criteria] = jevChoose.mock.calls[0]!;
    expect(instructions).toMatch(/judge/);
    expect(criteria).toEqual({ s0: "[Alpha] + [Bravo]", s1: "[Charlie] + [Delta]" });
  });

  it("returns null when Jev throws", async () => {
    const black = await blackCard("Why _?", 1);
    jevChoose.mockRejectedValue(new Error("timeout"));

    expect(
      await decide({
        lobbyId,
        mode: "judge",
        blackCardId: black,
        submissions: [[hand[0]], [hand[1]]],
      }),
    ).toEqual({ winnerIndex: null });
  });
});

describe("POST /api/bot/decide — personas", () => {
  it.each([
    ["GloomyBadger", /darkest and most shocking/],
    ["ZanyWaffle", /most absurd and surreal/],
    ["FrostyKitten", /laugh hardest/],
  ])("%s plays with its own taste", async (name, marker) => {
    const black = await blackCard("Why _?", 1);
    const id = await addBot(name);
    prefer(first);

    await decide({ lobbyId, mode: "play", blackCardId: black, botUserId: id, hand });

    expect(jevChoose.mock.calls[0]![1]).toMatch(marker);
  });

  it("keeps the taste on every card of a multi-card prompt", async () => {
    const black = await blackCard("_ + _", 2);
    const id = await addBot("GloomyBadger");
    prefer(first);

    await decide({ lobbyId, mode: "play", blackCardId: black, botUserId: id, hand });

    expect(jevChoose).toHaveBeenCalledTimes(2);
    for (const call of jevChoose.mock.calls) {
      expect(call[1]).toMatch(/darkest and most shocking/);
    }
  });

  it("judges with the judge bot's taste", async () => {
    const black = await blackCard("Why _?", 1);
    const id = await addBot("ZanyWaffle");
    prefer(first);

    await decide({
      lobbyId,
      mode: "judge",
      blackCardId: black,
      botUserId: id,
      submissions: [[hand[0]], [hand[1]]],
    });

    expect(jevChoose.mock.calls[0]![1]).toMatch(/You are the judge\. Which submitted card is the most absurd/);
  });

  it("rejects a request that does not say which bot is asking", async () => {
    const black = await blackCard("Why _?", 1);
    await expect(
      decide({ lobbyId, mode: "play", blackCardId: black, botUserId: undefined, hand }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("refuses a bot from another lobby", async () => {
    const black = await blackCard("Why _?", 1);
    const [other] = await db
      .insert(lobbies)
      .values({ code: "ELSE", hostUserId: currentUserId, status: "playing" })
      .returning();
    const strangerBot = await addBot("GloomyBadger", other!.id);
    prefer(first);

    await expect(
      decide({ lobbyId, mode: "play", blackCardId: black, botUserId: strangerBot, hand }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(jevChoose).not.toHaveBeenCalled();
  });

  it("refuses a human player's id", async () => {
    const black = await blackCard("Why _?", 1);
    prefer(first);

    await expect(
      decide({ lobbyId, mode: "play", blackCardId: black, botUserId: currentUserId, hand }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(jevChoose).not.toHaveBeenCalled();
  });
});

describe("POST /api/bot/decide — guards", () => {
  it("rejects a bad mode", async () => {
    const black = await blackCard("Why _?", 1);
    await expect(
      decide({ lobbyId, mode: "chaos", blackCardId: black, hand }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a non-uuid black card id", async () => {
    await expect(
      decide({ lobbyId, mode: "play", blackCardId: "", hand }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a hand over 20 cards", async () => {
    const black = await blackCard("Why _?", 1);
    const big = Array.from({ length: 21 }, () => randomUUID());
    await expect(
      decide({ lobbyId, mode: "play", blackCardId: black, hand: big }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a submission of more than 3 cards", async () => {
    const black = await blackCard("Why _?", 1);
    await expect(
      decide({
        lobbyId,
        mode: "judge",
        blackCardId: black,
        submissions: [hand.slice(0, 4)],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("refuses a caller who is not in the lobby", async () => {
    const black = await blackCard("Why _?", 1);
    const [stranger] = await db.insert(users).values({ name: "Stranger" }).returning();
    currentUserId = stranger!.id;

    await expect(
      decide({ lobbyId, mode: "play", blackCardId: black, hand }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("refuses a lobby with no bots, without asking Jev", async () => {
    const black = await blackCard("Why _?", 1);
    await db.delete(players).where(eq(players.playerType, "bot"));
    prefer(first);

    await expect(
      decide({ lobbyId, mode: "play", blackCardId: black, hand }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(jevChoose).not.toHaveBeenCalled();
  });

  it("rate-limits across all lobbies past the process-wide ceiling", async () => {
    const black = await blackCard("Why _?", 1);
    // Fill the shared bucket as if many other lobbies had been asking.
    for (let i = 0; i < 600; i++) {
      consumeRateLimit("bot-decide:global", { limit: 600, windowMs: 60_000 });
    }
    prefer(first);

    await expect(
      decide({ lobbyId, mode: "play", blackCardId: black, hand }),
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(jevChoose).not.toHaveBeenCalled();
  });

  it("rate-limits a lobby past 60 requests a minute", async () => {
    configured = false; // cheapest path; the limit is checked before Jev
    const black = await blackCard("Why _?", 1);
    for (let i = 0; i < 60; i++) {
      await decide({ lobbyId, mode: "play", blackCardId: black, hand });
    }
    await expect(
      decide({ lobbyId, mode: "play", blackCardId: black, hand }),
    ).rejects.toMatchObject({ statusCode: 429 });
  });
});
