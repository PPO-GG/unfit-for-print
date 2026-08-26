// @vitest-environment node

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { Client } from "pg";
import { useDb } from "~/server/db/client";
import { users } from "~/server/db/schema";
import { verifyActivityToken } from "~/server/utils/activityToken";

const db = useDb();
const fetchMock = vi.fn<typeof fetch>();

vi.stubGlobal("useRuntimeConfig", () => ({
  public: { discordClientId: "activity-client" },
  discordClientSecret: "activity-secret",
}));
vi.stubGlobal("readBody", async (event: { body?: unknown }) => event.body);
vi.stubGlobal("createError", ({ statusCode, message }: { statusCode: number; message: string }) =>
  Object.assign(new Error(message), { statusCode }),
);
vi.stubGlobal("fetch", fetchMock);

type ActivityHandler = (event: { body?: unknown }) => Promise<{
  token: string;
  accessToken: string;
  discordUser: { id: string; username: string; avatar: string | null; avatarUrl: string | null };
}>;

let handler: ActivityHandler;

beforeAll(async () => {
  handler = (await import("~/server/api/auth/discord-activity.post")).default as ActivityHandler;
});

function discordResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockDiscordIdentity({
  id = "activity-user-1",
  username = "ActivityUser",
  avatar = "avatar-hash",
}: {
  id?: string;
  username?: string;
  avatar?: string | null;
} = {}) {
  fetchMock.mockImplementation(async (input) => {
    const url = input.toString();
    if (url === "https://discord.com/api/oauth2/token") {
      return discordResponse({ access_token: "discord-access-token", token_type: "Bearer" });
    }
    if (url === "https://discord.com/api/users/@me") {
      return discordResponse({
        id,
        username,
        avatar,
        discriminator: "0",
        global_name: username,
        public_flags: 0,
        flags: 0,
      });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  });
}

async function waitForBlockedUserInsert(): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const result = await db.execute(sql`
      SELECT query
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
        AND wait_event_type = 'Lock'
        AND query LIKE 'insert into "users"%'
    `);
    if (result.rows.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for the Activity user insert to block");
}

beforeEach(async () => {
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
  process.env.NUXT_ACTIVITY_TOKEN_SECRET = "test-secret-at-least-32-chars-long";
  fetchMock.mockReset();
});

describe("discord-activity route", () => {
  it("creates a Discord user and returns the signed Activity response contract", async () => {
    mockDiscordIdentity();

    const result = await handler({ body: { code: "authorization-code" } });

    expect(result).toEqual({
      token: expect.any(String),
      accessToken: "discord-access-token",
      discordUser: {
        id: "activity-user-1",
        username: "ActivityUser",
        avatar: "avatar-hash",
        avatarUrl: "https://cdn.discordapp.com/avatars/activity-user-1/avatar-hash.png?size=128",
      },
    });

    const [created] = await db
      .select()
      .from(users)
      .where(eq(users.discordUserId, "activity-user-1"));
    expect(created).toMatchObject({
      discordUserId: "activity-user-1",
      name: "ActivityUser",
      avatarUrl: "https://cdn.discordapp.com/avatars/activity-user-1/avatar-hash.png?size=128",
      isGuest: false,
    });
    expect(verifyActivityToken(result.token)?.userId).toBe(created.id);
  });

  it("refreshes the existing Discord user's profile and signs its database id", async () => {
    const [existing] = await db
      .insert(users)
      .values({
        discordUserId: "activity-user-2",
        name: "Old ActivityUser",
        avatarUrl: "https://example.com/old-avatar.png",
        isGuest: false,
      })
      .returning();
    mockDiscordIdentity({ id: "activity-user-2", username: "Updated ActivityUser", avatar: null });

    const result = await handler({ body: { code: "authorization-code" } });

    expect(verifyActivityToken(result.token)?.userId).toBe(existing.id);
    expect(result.discordUser).toEqual({
      id: "activity-user-2",
      username: "Updated ActivityUser",
      avatar: null,
      avatarUrl: null,
    });
    const [updated] = await db.select().from(users).where(eq(users.id, existing.id));
    expect(updated).toMatchObject({
      name: "Updated ActivityUser",
      avatarUrl: null,
      isGuest: false,
    });
  });

  it("returns a 400 error when the Activity authorization code is missing", async () => {
    await expect(handler({ body: {} })).rejects.toMatchObject({
      statusCode: 400,
      message: "Missing authorization code",
    });
  });

  it("returns a 401 error when Discord rejects the authorization code", async () => {
    fetchMock.mockResolvedValue(discordResponse({ error: "invalid_grant" }, 400));

    await expect(handler({ body: { code: "expired-authorization-code" } })).rejects.toMatchObject({
      statusCode: 401,
      message: "Discord token exchange failed",
    });
  });

  it("resolves a first-login insert conflict to the existing Discord user", async () => {
    const competingTransaction = new Client({ connectionString: process.env.DATABASE_URL });
    await competingTransaction.connect();
    await competingTransaction.query("BEGIN");
    const competingUser = await competingTransaction.query<{ id: string }>(
      `INSERT INTO users (discord_user_id, name, is_guest)
       VALUES ($1, $2, false)
       RETURNING id`,
      ["concurrent-activity-user", "Competing ActivityUser"],
    );
    mockDiscordIdentity({
      id: "concurrent-activity-user",
      username: "Concurrent ActivityUser",
      avatar: null,
    });

    try {
      const request = handler({ body: { code: "authorization-code" } });
      await waitForBlockedUserInsert();
      await competingTransaction.query("COMMIT");

      const result = await request;
      const [stored] = await db
        .select()
        .from(users)
        .where(eq(users.discordUserId, "concurrent-activity-user"));
      expect(stored).toMatchObject({
        id: competingUser.rows[0]!.id,
        name: "Concurrent ActivityUser",
        avatarUrl: null,
        isGuest: false,
      });
      expect(verifyActivityToken(result.token)?.userId).toBe(stored.id);
    } finally {
      await competingTransaction.query("ROLLBACK").catch(() => undefined);
      await competingTransaction.end();
    }
  });
});
