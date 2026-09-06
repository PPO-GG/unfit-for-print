// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, players, users } from "~/server/db/schema";
import {
  requireAdmin,
  requireAuth,
  requireHost,
  requireNonGuest,
  requirePlayerInLobby,
} from "~/server/utils/session";

const db = useDb();

let mockSessionUserId: string | null = null;
vi.stubGlobal("getUserSession", async () => ({
  user: mockSessionUserId ? { id: mockSessionUserId } : undefined,
}));

function mockEvent() {
  return { node: { req: { headers: {} } } } as any;
}

beforeEach(async () => {
  mockSessionUserId = null;
  await db.execute(sql`
    TRUNCATE TABLE
      "users",
      "lobbies",
      "players",
      "white_cards",
      "black_cards",
      "submissions",
      "reports",
      "decorations",
      "user_decorations"
    RESTART IDENTITY CASCADE
  `);
});

describe("requireAuth", () => {
  it("throws 401 with no session and no bearer token", async () => {
    await expect(requireAuth(mockEvent())).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("requirePlayerInLobby / requireHost", () => {
  it("throws 403 when the user is not a player in the lobby", async () => {
    const [user] = await db.insert(users).values({ name: "U" }).returning();
    const [lobby] = await db
      .insert(lobbies)
      .values({ code: "AAAA", hostUserId: user.id })
      .returning();
    mockSessionUserId = user.id;

    await expect(requirePlayerInLobby(mockEvent(), lobby.id)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("returns the host id when the caller is the lobby host", async () => {
    const [user] = await db.insert(users).values({ name: "Host" }).returning();
    const [lobby] = await db
      .insert(lobbies)
      .values({ code: "HOST", hostUserId: user.id })
      .returning();
    await db.insert(players).values({
      userId: user.id,
      lobbyId: lobby.id,
      name: "Host",
      isHost: true,
    });
    mockSessionUserId = user.id;

    await expect(requireHost(mockEvent(), lobby.id)).resolves.toBe(user.id);
  });
});

describe("requireAdmin", () => {
  it("throws 403 for a non-admin user", async () => {
    const [user] = await db
      .insert(users)
      .values({ name: "U", isAdmin: false })
      .returning();
    mockSessionUserId = user.id;

    await expect(requireAdmin(mockEvent())).rejects.toMatchObject({ statusCode: 403 });
  });

  it("passes for an admin user and returns their id", async () => {
    const [user] = await db
      .insert(users)
      .values({ name: "A", isAdmin: true })
      .returning();
    mockSessionUserId = user.id;

    await expect(requireAdmin(mockEvent())).resolves.toBe(user.id);
  });
});

describe("requireNonGuest", () => {
  it("throws 403 for a guest session", async () => {
    const [user] = await db
      .insert(users)
      .values({ name: "G", isGuest: true })
      .returning();
    mockSessionUserId = user.id;

    await expect(requireNonGuest(mockEvent())).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("returns the id for a signed-in user", async () => {
    const [user] = await db
      .insert(users)
      .values({ name: "R", isGuest: false, discordUserId: "d-1" })
      .returning();
    mockSessionUserId = user.id;

    await expect(requireNonGuest(mockEvent())).resolves.toBe(user.id);
  });

  it("throws 401 before it ever looks the user up, with no session", async () => {
    mockSessionUserId = null;

    await expect(requireNonGuest(mockEvent())).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  // A session whose user row has since been deleted must not slip through the
  // isGuest check by simply being absent.
  it("throws 403 when the session points at a user that no longer exists", async () => {
    mockSessionUserId = "00000000-0000-0000-0000-000000000000";

    await expect(requireNonGuest(mockEvent())).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
