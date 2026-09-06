// @vitest-environment node
//
// Server-side guards for lobby creation and joining.
//
// Both rules existed only in the UI before this: `app/pages/index.vue` disabled
// the create button for guests, and nothing at all stopped a client from
// inserting itself into a game already in progress. Neither is enforceable in a
// component — anyone can call the route directly.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, players, users } from "~/server/db/schema";

const db = useDb();

let mockSessionUserId: string | null = null;
vi.stubGlobal("getUserSession", async () => ({
  user: mockSessionUserId ? { id: mockSessionUserId } : undefined,
}));

function mockEvent(body: unknown) {
  globalThis.readBody = async () => body;
  return { node: { req: { headers: {} } } } as any;
}

const createHandler = async () =>
  (await import("~/server/api/lobby/create.post")).default;
const joinHandler = async () =>
  (await import("~/server/api/lobby/join.post")).default;

let guestId: string;
let discordId: string;

beforeEach(async () => {
  mockSessionUserId = null;
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);

  const [guest] = await db
    .insert(users)
    .values({ name: "Guesty", isGuest: true })
    .returning();
  const [real] = await db
    .insert(users)
    .values({ name: "RealUser", isGuest: false, discordUserId: "discord-1" })
    .returning();
  guestId = guest!.id;
  discordId = real!.id;
});

describe("POST /api/lobby/create — hosting requires a real account", () => {
  it("refuses a guest", async () => {
    mockSessionUserId = guestId;

    await expect(
      (await createHandler())(mockEvent({ hostUserId: guestId })),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(await db.select().from(lobbies)).toHaveLength(0);
  });

  it("lets a signed-in user host", async () => {
    mockSessionUserId = discordId;

    const lobby = await (await createHandler())(
      mockEvent({ hostUserId: discordId, lobbyName: "Real" }),
    );

    expect(lobby.hostUserId).toBe(discordId);
    expect(lobby.status).toBe("waiting");
  });

  it("still refuses without any session at all", async () => {
    mockSessionUserId = null;

    await expect(
      (await createHandler())(mockEvent({ hostUserId: discordId })),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("POST /api/lobby/join — a game in progress only takes spectators", () => {
  const seedLobby = async (status: "waiting" | "playing" | "complete") => {
    const [lobby] = await db
      .insert(lobbies)
      .values({ code: "GRD1", hostUserId: discordId, status })
      .returning();
    await db.insert(players).values({
      userId: discordId,
      lobbyId: lobby!.id,
      name: "RealUser",
      isHost: true,
      playerType: "player",
    });
    return lobby!;
  };

  it("seats a joiner as a player while the lobby is still waiting", async () => {
    await seedLobby("waiting");
    mockSessionUserId = guestId;

    const { player } = await (await joinHandler())(
      mockEvent({ code: "GRD1", playerName: "Guesty" }),
    );

    expect(player.playerType).toBe("player");
  });

  // This is the hole: nothing stopped a client from inserting itself as an
  // active player into a round already under way, where the Y.Doc's playerOrder
  // and hands know nothing about them.
  it("downgrades a mid-game joiner to spectator", async () => {
    await seedLobby("playing");
    mockSessionUserId = guestId;

    const { player } = await (await joinHandler())(
      mockEvent({ code: "GRD1", playerName: "Guesty" }),
    );

    expect(player.playerType).toBe("spectator");
  });

  it("downgrades a joiner to spectator once the game is complete", async () => {
    await seedLobby("complete");
    mockSessionUserId = guestId;

    const { player } = await (await joinHandler())(
      mockEvent({ code: "GRD1", playerName: "Guesty" }),
    );

    expect(player.playerType).toBe("spectator");
  });

  it("honours an explicit spectator request in a waiting lobby", async () => {
    await seedLobby("waiting");
    mockSessionUserId = guestId;

    const { player } = await (await joinHandler())(
      mockEvent({
        code: "GRD1",
        playerName: "Guesty",
        playerType: "spectator",
      }),
    );

    expect(player.playerType).toBe("spectator");
  });

  // A player whose tab dropped mid-round must come back as a player, not be
  // demoted to spectator by the new guard.
  it("returns a reconnecting player's existing row untouched mid-game", async () => {
    const lobby = await seedLobby("playing");
    mockSessionUserId = discordId;

    const { player } = await (await joinHandler())(
      mockEvent({ code: "GRD1", playerName: "RealUser" }),
    );

    expect(player.playerType).toBe("player");
    expect(player.isHost).toBe(true);

    const rows = await db
      .select()
      .from(players)
      .where(eq(players.lobbyId, lobby.id));
    expect(rows).toHaveLength(1);
  });

  it("still 404s on a code that matches no lobby", async () => {
    mockSessionUserId = guestId;

    await expect(
      (await joinHandler())(mockEvent({ code: "NOPE", playerName: "Guesty" })),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
