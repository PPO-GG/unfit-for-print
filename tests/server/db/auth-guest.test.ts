// @vitest-environment node
//
// POST /api/auth/guest is the only unauthenticated route that writes to
// `users`, and it wrote a fresh row on every call — including the ordinary
// case of somebody retyping their name on the join screen. So the table grew
// from normal use, and a loop against the route grew it without bound.
//
// Two changes are covered here: an existing guest session is reused and
// renamed rather than replaced, and callers without one are throttled per IP.

import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, players, users } from "~/server/db/schema";
import { __resetRateLimits } from "~/server/utils/rateLimit";

const db = useDb();

let sessionUser: Record<string, unknown> | null = null;
let requestIp: string | undefined = "203.0.113.7";
const responseHeaders: Record<string, string> = {};

vi.stubGlobal("getUserSession", async () => ({ user: sessionUser ?? undefined }));
vi.stubGlobal("setUserSession", async (_e: unknown, data: any) => {
  sessionUser = data.user;
});
vi.stubGlobal("getRequestIP", () => requestIp);
vi.stubGlobal("setResponseHeader", (_e: unknown, k: string, v: string) => {
  responseHeaders[k] = v;
});
vi.stubGlobal("useRuntimeConfig", () => ({ guestRateLimit: 3 }));

function mockEvent(body: unknown) {
  globalThis.readBody = async () => body;
  return { node: { req: { headers: {} } } } as any;
}

const guestHandler = async () =>
  (await import("~/server/api/auth/guest.post")).default;

beforeEach(async () => {
  sessionUser = null;
  requestIp = "203.0.113.7";
  for (const k of Object.keys(responseHeaders)) delete responseHeaders[k];
  __resetRateLimits();
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
});

afterEach(() => {
  __resetRateLimits();
});

describe("POST /api/auth/guest", () => {
  it("creates a guest user and signs them in", async () => {
    const handler = await guestHandler();
    const result: any = await handler(mockEvent({ username: "Newcomer" }));

    expect(result.user.name).toBe("Newcomer");
    expect(result.user.isGuest).toBe(true);

    const rows = await db.select().from(users);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Newcomer");
    expect(rows[0]!.isGuest).toBe(true);
    expect(rows[0]!.discordUserId).toBeNull();
  });

  it("rejects a username outside 1-32 characters", async () => {
    const handler = await guestHandler();

    await expect(handler(mockEvent({ username: "   " }))).rejects.toThrow();
    await expect(
      handler(mockEvent({ username: "x".repeat(33) })),
    ).rejects.toThrow();
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it("renames the existing guest instead of minting a second row", async () => {
    const handler = await guestHandler();
    await handler(mockEvent({ username: "First" }));
    const [created] = await db.select().from(users);

    const result: any = await handler(mockEvent({ username: "Second" }));

    // Same identity — a guest who retypes their name keeps their user id, so
    // their player rows and card stats stay attached to them.
    expect(result.user.id).toBe(created!.id);
    expect(result.user.name).toBe("Second");
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("does not spend the rate limit on reuse", async () => {
    const handler = await guestHandler();
    // limit is 3; without the reuse path these five calls would 429.
    for (const name of ["a", "b", "c", "d", "e"]) {
      await handler(mockEvent({ username: name }));
    }

    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("starts a new guest when the session points at a deleted user", async () => {
    const handler = await guestHandler();
    await handler(mockEvent({ username: "Ghost" }));
    await db.delete(users);

    const result: any = await handler(mockEvent({ username: "Ghost" }));

    expect(result.user.name).toBe("Ghost");
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("leaves a signed-in Discord account alone", async () => {
    const [discordUser] = await db
      .insert(users)
      .values({ name: "RealAccount", isGuest: false, discordUserId: "d-1" })
      .returning();
    sessionUser = { id: discordUser!.id, isGuest: false };

    const handler = await guestHandler();
    const result: any = await handler(mockEvent({ username: "Sneaky" }));

    // A new guest identity, not a rename of the Discord account.
    expect(result.user.id).not.toBe(discordUser!.id);
    const [stillNamed] = await db
      .select()
      .from(users)
      .where(eq(users.id, discordUser!.id));
    expect(stillNamed!.name).toBe("RealAccount");
  });

  it("throttles fresh guests from one address", async () => {
    const handler = await guestHandler();

    for (let i = 0; i < 3; i++) {
      sessionUser = null; // each call arrives with no cookie
      await handler(mockEvent({ username: `guest-${i}` }));
    }

    sessionUser = null;
    await expect(
      handler(mockEvent({ username: "guest-4" })),
    ).rejects.toMatchObject({ statusCode: 429 });

    expect(responseHeaders["Retry-After"]).toBeDefined();
    expect(await db.select().from(users)).toHaveLength(3);
  });

  it("counts each address separately", async () => {
    const handler = await guestHandler();

    for (let i = 0; i < 3; i++) {
      sessionUser = null;
      await handler(mockEvent({ username: `guest-${i}` }));
    }

    sessionUser = null;
    requestIp = "198.51.100.4";
    const result: any = await handler(mockEvent({ username: "elsewhere" }));

    expect(result.user.name).toBe("elsewhere");
  });
});
