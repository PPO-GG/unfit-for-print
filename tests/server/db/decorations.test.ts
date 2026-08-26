import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq, and } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, decorations, userDecorations, players } from "~/server/db/schema";

const db = useDb();
let currentUserId: string;

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return {
    ...actual,
    requireAuth: async () => currentUserId,
    requireAdmin: async () => currentUserId,
  };
});

function mockEvent(body?: unknown) {
  globalThis.readBody = async () => body;
  return {} as any;
}

beforeEach(async () => {
  await db.delete(userDecorations);
  await db.delete(decorations);
  await db.delete(players);
  await db.delete(users);
  const [user] = await db.insert(users).values({ name: "U" }).returning();
  currentUserId = user.id;
});

describe("decorations", () => {
  it("equip rejects an unowned, non-free decoration", async () => {
    await db.insert(decorations).values({
      id: "hat",
      name: "Hat",
      description: "A hat",
      type: "hat",
      rarity: "common",
      enabled: true,
      freeForAll: false,
    });

    const handler = (await import("~/server/api/decorations/equip.post")).default;
    await expect(handler(mockEvent({ decorationId: "hat" }))).rejects.toMatchObject({ statusCode: 403 });
  });

  it("equip succeeds for a free-for-all decoration and writes the users column directly", async () => {
    await db.insert(decorations).values({
      id: "badge",
      name: "Badge",
      description: "A badge",
      type: "badge",
      rarity: "common",
      enabled: true,
      freeForAll: true,
    });

    const handler = (await import("~/server/api/decorations/equip.post")).default;
    const result = await handler(mockEvent({ decorationId: "badge" }));
    expect(result.activeDecoration).toBe("badge");

    const [user] = await db.select().from(users).where(eq(users.id, currentUserId));
    expect(user.activeDecoration).toBe("badge");
  });

  it("equip succeeds for an owned decoration", async () => {
    await db.insert(decorations).values({
      id: "cape",
      name: "Cape",
      description: "A cape",
      type: "cape",
      rarity: "rare",
      enabled: true,
      freeForAll: false,
    });
    await db.insert(userDecorations).values({ userId: currentUserId, decorationId: "cape", source: "grant" });

    const handler = (await import("~/server/api/decorations/equip.post")).default;
    const result = await handler(mockEvent({ decorationId: "cape" }));
    expect(result.activeDecoration).toBe("cape");
  });

  it("catalog returns the legacy DecorationCatalogEntry compat shape", async () => {
    await db.insert(decorations).values({
      id: "cape",
      name: "Cape",
      description: "A cape",
      type: "cape",
      rarity: "rare",
      category: "custom",
      enabled: true,
      freeForAll: false,
      discordSkuId: "sku_123",
      price: "4.99",
      sortOrder: 3,
      imageKey: "cape-image-key",
      imageFormat: "png",
    });

    const handler = (await import("~/server/api/decorations/catalog.get")).default;
    const result = await handler({} as any);

    expect(result).toHaveLength(1);
    const entry = result[0];
    expect(entry.$id).toBe("cape");
    expect(entry.decorationId).toBe("cape");
    expect(entry.imageFileId).toBe("cape-image-key");
    expect(entry.imageFormat).toBe("png");
    expect(entry.attachment).toBeNull();
    expect(entry.price).toBe(4.99);
    expect(typeof entry.price).toBe("number");
    expect(entry.category).toBe("custom");
    expect(entry.discordSkuId).toBe("sku_123");
  });

  it("catalog omits disabled decorations and defaults missing fields", async () => {
    await db.insert(decorations).values([
      {
        id: "hidden",
        name: "Hidden",
        description: "Not visible",
        type: "effect",
        rarity: "common",
        enabled: false,
        freeForAll: false,
      },
      {
        id: "plain",
        name: "Plain",
        description: "No category or image",
        type: "effect",
        rarity: "common",
        enabled: true,
        freeForAll: true,
      },
    ]);

    const handler = (await import("~/server/api/decorations/catalog.get")).default;
    const result = await handler({} as any);

    expect(result).toHaveLength(1);
    expect(result[0].decorationId).toBe("plain");
    expect(result[0].category).toBe("custom");
    expect(result[0].imageFileId).toBeNull();
    expect(result[0].discordSkuId).toBeNull();
  });
});
