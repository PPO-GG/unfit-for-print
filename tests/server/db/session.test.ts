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
// Profile fields the cookie snapshotted at login, which can go stale.
let mockSessionFields: Record<string, unknown> = {};
let sessionCleared = false;
vi.stubGlobal("getUserSession", async () => ({
  user: mockSessionUserId
    ? { ...mockSessionFields, id: mockSessionUserId }
    : undefined,
}));
vi.stubGlobal("clearUserSession", async () => {
  sessionCleared = true;
  mockSessionUserId = null;
});

function mockEvent() {
  return { node: { req: { headers: {} } } } as any;
}

beforeEach(async () => {
  mockSessionUserId = null;
  mockSessionFields = {};
  sessionCleared = false;
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

  // Now caught one layer earlier — requireAuth refuses a session whose user is
  // gone, so this never reaches the isGuest check.
  it("throws 401 when the session points at a user that no longer exists", async () => {
    mockSessionUserId = "00000000-0000-0000-0000-000000000000";

    await expect(requireNonGuest(mockEvent())).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});

// Leaving a lobby deletes an ephemeral guest account. The session cookie used
// to survive that, so the next request authenticated as a user row that no
// longer existed and the id flowed into inserts until a foreign key blew up.
describe("a session that outlived its user", () => {
  it("requireAuth refuses it rather than handing on a dead id", async () => {
    mockSessionUserId = "00000000-0000-0000-0000-000000000000";

    await expect(requireAuth(mockEvent())).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("requireAuth still works for a user that exists", async () => {
    const [user] = await db.insert(users).values({ name: "Alive" }).returning();
    mockSessionUserId = user.id;

    await expect(requireAuth(mockEvent())).resolves.toBe(user.id);
  });

  it("GET /api/auth/session reports no user, and clears the stale cookie", async () => {
    mockSessionUserId = "00000000-0000-0000-0000-000000000000";

    const handler = (await import("~/server/api/auth/session.get")).default;
    const res: any = await handler(mockEvent());

    // The client keys "am I logged in" off this, so returning the dead user
    // left it convinced it was signed in with no way to recover.
    expect(res.user).toBeNull();
    expect(sessionCleared).toBe(true);
  });

  it("GET /api/auth/session returns a user that still exists", async () => {
    const [user] = await db.insert(users).values({ name: "Alive" }).returning();
    mockSessionUserId = user.id;

    const handler = (await import("~/server/api/auth/session.get")).default;
    const res: any = await handler(mockEvent());

    expect(res.user?.id).toBe(user.id);
    expect(sessionCleared).toBe(false);
  });
});

// The cookie is written once at login, but equipping a decoration only updates
// the users row. Returning the cookie's copy undid the equip on every reload.
describe("GET /api/auth/session profile fields", () => {
  it("returns the live activeDecoration, not the one snapshotted at login", async () => {
    const [user] = await db
      .insert(users)
      .values({ name: "Equipper", activeDecoration: "founder-ring" })
      .returning();
    mockSessionUserId = user.id;
    mockSessionFields = { name: "Equipper", activeDecoration: null };

    const handler = (await import("~/server/api/auth/session.get")).default;
    const res: any = await handler(mockEvent());

    expect(res.user?.activeDecoration).toBe("founder-ring");
  });
});
