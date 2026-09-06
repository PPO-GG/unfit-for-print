import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, lobbies, players, blackCards } from "~/server/db/schema";

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

const handler = async () =>
  (await import("~/server/api/game/record-skip.post")).default;

let lobbyId: string;
let hostId: string;
let black: string;

beforeEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
  await db.delete(blackCards);

  const [host] = await db.insert(users).values({ name: "Host" }).returning();
  hostId = host!.id;
  currentUserId = host!.id;

  const [lobby] = await db
    .insert(lobbies)
    .values({ code: "SKIP", hostUserId: hostId, status: "playing" })
    .returning();
  lobbyId = lobby!.id;

  await db.insert(players).values({
    userId: hostId, lobbyId, name: "Host", isHost: true, playerType: "player",
  });

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
  await db.delete(blackCards);
});

const readSkipped = async (id: string) => {
  const [row] = await db
    .select({ skipped: blackCards.timesSkipped })
    .from(blackCards)
    .where(eq(blackCards.id, id));
  return row!.skipped;
};

describe("POST /api/game/record-skip", () => {
  it("increments times_skipped for the skipped card", async () => {
    await (await handler())(mockEvent({ lobbyId, blackCardId: black }));
    expect(await readSkipped(black)).toBe(1);
  });

  it("accumulates across skips rather than overwriting", async () => {
    const h = await handler();
    await h(mockEvent({ lobbyId, blackCardId: black }));
    await h(mockEvent({ lobbyId, blackCardId: black }));
    expect(await readSkipped(black)).toBe(2);
  });

  // nextRound writes { id: "" } when the black deck is exhausted. That empty
  // string reaches a uuid column, where it is a query error, not a miss.
  it("ignores the exhausted-deck sentinel", async () => {
    await (await handler())(mockEvent({ lobbyId, blackCardId: "" }));
    expect(await readSkipped(black)).toBe(0);
  });

  it("ignores a malformed card id", async () => {
    await (await handler())(mockEvent({ lobbyId, blackCardId: "not-a-uuid" }));
    expect(await readSkipped(black)).toBe(0);
  });

  it("rejects a caller who is not a player in the lobby", async () => {
    const [outsider] = await db.insert(users).values({ name: "Out" }).returning();
    currentUserId = outsider!.id;
    await expect(
      (await handler())(mockEvent({ lobbyId, blackCardId: black })),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(await readSkipped(black)).toBe(0);
  });

  it("rejects a body with no lobbyId", async () => {
    await expect(
      (await handler())(mockEvent({ blackCardId: black })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
