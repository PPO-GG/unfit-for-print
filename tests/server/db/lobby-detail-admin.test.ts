import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, lobbies, players } from "~/server/db/schema";

const db = useDb();

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/server/utils/session")>();
  return { ...actual, requireAdmin: async () => "admin-id" };
});

function mockEvent(params: Record<string, string> = {}, body?: unknown) {
  globalThis.getRouterParam = (_e: unknown, name: string) => params[name];
  globalThis.readBody = async () => body;
  return {} as any;
}

beforeEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
});

afterEach(async () => {
  // Guard against leaking a lobby/player/user into other test files that
  // share this database (run with --no-file-parallelism).
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
});

describe("GET /api/lobby/[code]", () => {
  it("returns lobbyName populated (regression check for the $id/lobbyName bug)", async () => {
    const [host] = await db
      .insert(users)
      .values({ name: "Host" })
      .returning();
    await db
      .insert(lobbies)
      .values({ code: "NAME", hostUserId: host.id, lobbyName: "Fun Lobby" });

    const handler = (await import("~/server/api/lobby/[code]")).default;
    const result = await handler(mockEvent({ code: "NAME" }));
    expect(result.lobbyName).toBe("Fun Lobby");
  });
});

describe("admin lobby delete", () => {
  it("cascades player deletion via the FK, no manual loop needed", async () => {
    const [host] = await db
      .insert(users)
      .values({ name: "Host" })
      .returning();
    const [lobby] = await db
      .insert(lobbies)
      .values({ code: "DELX", hostUserId: host.id })
      .returning();
    await db
      .insert(players)
      .values({ userId: host.id, lobbyId: lobby.id, name: "Host", isHost: true });

    const handler = (await import("~/server/api/admin/lobby/delete.post"))
      .default;
    await handler(mockEvent({}, { lobbyId: lobby.id }));

    const remainingPlayers = await db
      .select()
      .from(players)
      .where(eq(players.lobbyId, lobby.id));
    expect(remainingPlayers).toHaveLength(0);
  });

  it("cleans up a bot's synthetic users row alongside the lobby", async () => {
    const [host] = await db
      .insert(users)
      .values({ name: "Host" })
      .returning();
    const [lobby] = await db
      .insert(lobbies)
      .values({ code: "DELB", hostUserId: host.id })
      .returning();
    await db
      .insert(players)
      .values({ userId: host.id, lobbyId: lobby.id, name: "Host", isHost: true });
    const [botUser] = await db
      .insert(users)
      .values({ name: "Bot1", isGuest: true })
      .returning();
    await db
      .insert(players)
      .values({ userId: botUser.id, lobbyId: lobby.id, name: "Bot1", playerType: "bot" });

    const handler = (await import("~/server/api/admin/lobby/delete.post"))
      .default;
    await handler(mockEvent({}, { lobbyId: lobby.id }));

    const remainingBotUser = await db
      .select()
      .from(users)
      .where(eq(users.id, botUser.id));
    expect(remainingBotUser).toHaveLength(0);
    // The host's real user row must survive.
    const remainingHost = await db.select().from(users).where(eq(users.id, host.id));
    expect(remainingHost).toHaveLength(1);
  });
});
