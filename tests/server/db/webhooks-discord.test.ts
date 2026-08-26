// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { decorations, userDecorations, users } from "~/server/db/schema";

const db = useDb();

vi.mock("~/server/utils/discord-verify", () => ({
  verifyDiscordSignature: vi.fn(async () => true),
}));

vi.stubGlobal("useRuntimeConfig", () => ({ discordPublicKey: "test-public-key" }));

let currentRawBody: string | null = "{}";
vi.stubGlobal("readRawBody", async () => currentRawBody);
vi.stubGlobal("getHeader", (_event: unknown, name: string) => {
  if (name === "x-signature-ed25519") return "sig";
  if (name === "x-signature-timestamp") return "123";
  return undefined;
});
let lastStatus: number | undefined;
vi.stubGlobal("setResponseStatus", (_event: unknown, status: number) => {
  lastStatus = status;
});
vi.stubGlobal(
  "createError",
  ({ statusCode, statusMessage }: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(statusMessage), { statusCode }),
);

let handler: (event: unknown) => Promise<unknown>;

function entitlementBody(discordUserId: string, skuId: string) {
  return JSON.stringify({
    type: 1,
    event: {
      type: "ENTITLEMENT_CREATE",
      data: { user_id: discordUserId, sku_id: skuId },
    },
  });
}

beforeEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE "users", "decorations", "user_decorations" RESTART IDENTITY CASCADE
  `);
  lastStatus = undefined;
  currentRawBody = "{}";
  vi.clearAllMocks();
  const { verifyDiscordSignature } = await import("~/server/utils/discord-verify");
  vi.mocked(verifyDiscordSignature).mockResolvedValue(true);
  handler = (await import("~/server/api/webhooks/discord.post")).default as typeof handler;
});

describe("discord webhook", () => {
  it("grants the decoration to the matching user on ENTITLEMENT_CREATE", async () => {
    const [user] = await db
      .insert(users)
      .values({ discordUserId: "discord-user-1", name: "Buyer", isGuest: false })
      .returning();
    await db.insert(decorations).values({
      id: "golden-hat",
      name: "Golden Hat",
      description: "A fancy hat",
      type: "hat",
      rarity: "rare",
      discordSkuId: "sku-123",
    });

    currentRawBody = entitlementBody("discord-user-1", "sku-123");

    await handler({});

    expect(lastStatus).toBe(204);
    const [grant] = await db
      .select()
      .from(userDecorations)
      .where(eq(userDecorations.userId, user.id));
    expect(grant).toMatchObject({
      userId: user.id,
      decorationId: "golden-hat",
      source: "discord_purchase",
    });
  });

  it("is idempotent on a retried entitlement event", async () => {
    const [user] = await db
      .insert(users)
      .values({ discordUserId: "discord-user-2", name: "Buyer2", isGuest: false })
      .returning();
    await db.insert(decorations).values({
      id: "silver-cape",
      name: "Silver Cape",
      description: "A shiny cape",
      type: "cape",
      rarity: "rare",
      discordSkuId: "sku-456",
    });

    currentRawBody = entitlementBody("discord-user-2", "sku-456");

    await handler({});
    await handler({}); // retry — must not throw or duplicate

    const grants = await db
      .select()
      .from(userDecorations)
      .where(eq(userDecorations.userId, user.id));
    expect(grants).toHaveLength(1);
  });

  it("returns 204 without granting when the SKU is unknown", async () => {
    currentRawBody = entitlementBody("discord-user-3", "sku-unknown");

    await handler({});

    expect(lastStatus).toBe(204);
    const grants = await db.select().from(userDecorations);
    expect(grants).toHaveLength(0);
  });

  it("returns 204 without granting when no user matches the Discord ID", async () => {
    await db.insert(decorations).values({
      id: "orphan-decoration",
      name: "Orphan",
      description: "No buyer",
      type: "hat",
      rarity: "common",
      discordSkuId: "sku-789",
    });

    currentRawBody = entitlementBody("unknown-discord-user", "sku-789");

    await handler({});

    expect(lastStatus).toBe(204);
    const grants = await db.select().from(userDecorations);
    expect(grants).toHaveLength(0);
  });

  it("rejects an invalid signature", async () => {
    const { verifyDiscordSignature } = await import("~/server/utils/discord-verify");
    vi.mocked(verifyDiscordSignature).mockResolvedValue(false);

    currentRawBody = entitlementBody("discord-user-1", "sku-123");

    await expect(handler({})).rejects.toMatchObject({ statusCode: 401 });
  });
});
