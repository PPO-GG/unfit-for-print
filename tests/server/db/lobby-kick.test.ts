// @vitest-environment node
//
// POST /api/lobby/kick. Kicking used to touch only the Y.Doc, so the kicked
// player's row stayed in Postgres and the game page's rejoin check put them
// straight back in on their next refresh.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
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

const kick = async (body: unknown) =>
  (await import("~/server/api/lobby/kick.post")).default(mockEvent(body));

let hostId: string;
let memberId: string;
let botId: string;
let lobbyId: string;

async function clear() {
  // Lobbies before users: lobbies.host_user_id does not cascade.
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
}

beforeEach(async () => {
  mockSessionUserId = null;
  await clear();
  const [host] = await db.insert(users).values({ name: "Host", isGuest: false }).returning();
  const [member] = await db.insert(users).values({ name: "Member" }).returning();
  const [bot] = await db.insert(users).values({ name: "Bot" }).returning();
  hostId = host!.id;
  memberId = member!.id;
  botId = bot!.id;
  const [lobby] = await db.insert(lobbies).values({ code: "KICK", hostUserId: hostId }).returning();
  lobbyId = lobby!.id;
  await db.insert(players).values([
    { userId: hostId, lobbyId, name: "Host", isHost: true },
    { userId: memberId, lobbyId, name: "Member" },
    { userId: botId, lobbyId, name: "Bot", playerType: "bot" },
  ]);
});

afterEach(clear);

const seated = async (userId: string) =>
  (
    await db
      .select()
      .from(players)
      .where(and(eq(players.userId, userId), eq(players.lobbyId, lobbyId)))
  ).length > 0;

describe("POST /api/lobby/kick", () => {
  it("removes the kicked player's row, so a refresh cannot re-seat them", async () => {
    mockSessionUserId = hostId;

    await expect(kick({ lobbyId, userId: memberId })).resolves.toEqual({ success: true });

    expect(await seated(memberId)).toBe(false);
    expect(await seated(hostId)).toBe(true);
  });

  it("keeps the kicked player's account", async () => {
    // Their session still names it; deleting it here would sign them out.
    mockSessionUserId = hostId;

    await kick({ lobbyId, userId: memberId });

    const rows = await db.select().from(users).where(eq(users.id, memberId));
    expect(rows).toHaveLength(1);
  });

  it("rejects a caller who is not the host", async () => {
    mockSessionUserId = memberId;

    await expect(kick({ lobbyId, userId: hostId })).rejects.toMatchObject({ statusCode: 403 });
    expect(await seated(hostId)).toBe(true);
  });

  it("rejects the host kicking themselves", async () => {
    mockSessionUserId = hostId;

    await expect(kick({ lobbyId, userId: hostId })).rejects.toMatchObject({ statusCode: 400 });
    expect(await seated(hostId)).toBe(true);
  });

  it("leaves bots to /api/bot/remove, which also removes their synthetic account", async () => {
    mockSessionUserId = hostId;

    await expect(kick({ lobbyId, userId: botId })).rejects.toMatchObject({ statusCode: 404 });
    expect(await seated(botId)).toBe(true);
  });

  it("404s for someone not in the lobby", async () => {
    mockSessionUserId = hostId;
    const [stranger] = await db.insert(users).values({ name: "Stranger" }).returning();

    await expect(kick({ lobbyId, userId: stranger!.id })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("400s without a lobbyId or userId", async () => {
    mockSessionUserId = hostId;

    await expect(kick({ lobbyId })).rejects.toMatchObject({ statusCode: 400 });
    await expect(kick({ userId: memberId })).rejects.toMatchObject({ statusCode: 400 });
  });
});
