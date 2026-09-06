// @vitest-environment node
//
// Lobby seat limits.
//
// POST /api/lobby/join had no upper bound: anyone holding a 4-character code
// could insert `players` rows into a lobby forever, and every one of them was
// seated as an active player if the game had not started. That is both an
// abuse vector and an unplayable game — hands are dealt per player at start,
// and the round loop waits on every seated player to submit.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, lobbyPasswords, players, users } from "~/server/db/schema";
import {
  MAX_ACTIVE_PLAYERS,
  MAX_LOBBY_SEATS,
} from "~/server/utils/lobbyCapacity";

const db = useDb();

let mockSessionUserId: string | null = null;
vi.stubGlobal("getUserSession", async () => ({
  user: mockSessionUserId ? { id: mockSessionUserId } : undefined,
}));

function mockEvent(body: unknown) {
  globalThis.readBody = async () => body;
  return { node: { req: { headers: {} } } } as any;
}

const joinHandler = async () =>
  (await import("~/server/api/lobby/join.post")).default;

let hostId: string;
let lobbyId: string;

/** Seats `count` extra occupants directly, bypassing the route under test. */
async function seat(
  count: number,
  playerType: "player" | "spectator" | "bot",
) {
  for (let i = 0; i < count; i++) {
    const [u] = await db
      .insert(users)
      .values({ name: `${playerType}-${i}`, isGuest: true })
      .returning();
    await db.insert(players).values({
      userId: u!.id,
      lobbyId,
      name: `${playerType}-${i}`,
      isHost: false,
      playerType,
    });
  }
}

/** A fresh user with a session, ready to call the join route. */
async function newcomer(name = "Newcomer") {
  const [u] = await db
    .insert(users)
    .values({ name, isGuest: true })
    .returning();
  mockSessionUserId = u!.id;
  return u!.id;
}

beforeEach(async () => {
  mockSessionUserId = null;
  await db.delete(lobbyPasswords);
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);

  const [host] = await db
    .insert(users)
    .values({ name: "Host", isGuest: false, discordUserId: "d-host" })
    .returning();
  hostId = host!.id;

  const [lobby] = await db
    .insert(lobbies)
    .values({ code: "CAP1", hostUserId: hostId, status: "waiting" })
    .returning();
  lobbyId = lobby!.id;

  await db.insert(players).values({
    userId: hostId,
    lobbyId,
    name: "Host",
    isHost: true,
    playerType: "player",
  });
});

describe("POST /api/lobby/join — capacity", () => {
  it("seats a player normally when there is room", async () => {
    await newcomer();
    const handler = await joinHandler();

    const result: any = await handler(
      mockEvent({ code: "CAP1", playerName: "Newcomer" }),
    );

    expect(result.player.playerType).toBe("player");
  });

  it("seats latecomers as spectators once the player cap is reached", async () => {
    await seat(MAX_ACTIVE_PLAYERS - 1, "player"); // +host = cap
    await newcomer();
    const handler = await joinHandler();

    const result: any = await handler(
      mockEvent({ code: "CAP1", playerName: "Newcomer" }),
    );

    // Clamped rather than refused: the same thing the route already does for
    // anyone arriving after the game starts, so they can still watch.
    expect(result.player.playerType).toBe("spectator");
  });

  it("counts bots against the player cap", async () => {
    await seat(MAX_ACTIVE_PLAYERS - 2, "player");
    await seat(1, "bot"); // +host = cap
    await newcomer();
    const handler = await joinHandler();

    const result: any = await handler(
      mockEvent({ code: "CAP1", playerName: "Newcomer" }),
    );

    expect(result.player.playerType).toBe("spectator");
  });

  it("does not count spectators against the player cap", async () => {
    await seat(MAX_ACTIVE_PLAYERS - 2, "player");
    await seat(5, "spectator");
    await newcomer();
    const handler = await joinHandler();

    const result: any = await handler(
      mockEvent({ code: "CAP1", playerName: "Newcomer" }),
    );

    expect(result.player.playerType).toBe("player");
  });

  it("refuses the join once every seat is taken", async () => {
    await seat(MAX_LOBBY_SEATS - 1, "spectator"); // +host = every seat
    await newcomer();
    const handler = await joinHandler();

    await expect(
      handler(mockEvent({ code: "CAP1", playerName: "Newcomer" })),
    ).rejects.toMatchObject({ statusCode: 409 });

    const rows = await db
      .select()
      .from(players)
      .where(eq(players.lobbyId, lobbyId));
    expect(rows).toHaveLength(MAX_LOBBY_SEATS);
  });

  it("lets someone already seated back in when the lobby is full", async () => {
    await seat(MAX_LOBBY_SEATS - 2, "spectator");
    const returningId = await newcomer("Returning");
    await db.insert(players).values({
      userId: returningId,
      lobbyId,
      name: "Returning",
      isHost: false,
      playerType: "player",
    });

    const handler = await joinHandler();
    const result: any = await handler(
      mockEvent({ code: "CAP1", playerName: "Returning" }),
    );

    // Reconnecting must not be mistaken for a new arrival — they already hold
    // a seat, and their hand is in the Y.Doc.
    expect(result.player.playerType).toBe("player");
  });
});
