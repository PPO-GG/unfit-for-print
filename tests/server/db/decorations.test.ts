import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq, and } from "drizzle-orm";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
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

const r2Send = vi.hoisted(() => vi.fn());
vi.mock("~/server/utils/r2", () => ({
  useR2: () => ({ send: r2Send }),
  getR2Bucket: () => "decoration-images",
}));

function mockEvent(
  body?: unknown,
  params: Record<string, string> = {},
  query: Record<string, string> = {},
) {
  globalThis.readBody = async () => body;
  globalThis.getRouterParam = (_e: unknown, name: string) => params[name];
  globalThis.getQuery = () => query;
  return {} as any;
}

const deletedKeys = () =>
  r2Send.mock.calls.map(([cmd]) => cmd.input?.Key).filter(Boolean);

beforeEach(async () => {
  r2Send.mockReset();
  r2Send.mockResolvedValue({});
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
    expect(entry.layers).toEqual({
      v: 1,
      layers: [expect.objectContaining({ type: "image", asset: { key: "cape-image-key", format: "png" } })],
    });
  });

  it("catalog returns a saved layer stack, normalised, in preference to legacy fields", async () => {
    await db.insert(decorations).values({
      id: "halo", name: "Halo", description: "", type: "layered", rarity: "rare",
      enabled: true, freeForAll: true, imageKey: "old.png", imageFormat: "png",
      layers: { v: 1, layers: [{ type: "ring", id: "r", thickness: 99 }] } as never,
    });
    const handler = (await import("~/server/api/decorations/catalog.get")).default;
    const [entry] = await handler({} as any);
    expect(entry.layers.layers).toHaveLength(1);
    expect(entry.layers.layers[0]).toMatchObject({ type: "ring", thickness: 0.25 });
  });

  it("admin list includes layers for hidden decorations too", async () => {
    await db.insert(decorations).values({
      id: "draft", name: "Draft", description: "", type: "layered", rarity: "common",
      enabled: false, freeForAll: false, layers: { v: 1, layers: [] } as never,
    });
    const handler = (await import("~/server/api/admin/decorations/list.get")).default;
    const list = await handler({} as any);
    expect(list.find((d) => d.decorationId === "draft")?.layers).toEqual({ v: 1, layers: [] });
  });

  it("create slugifies the name, avoids collisions, and starts hidden", async () => {
    const create = (await import("~/server/api/admin/decorations/index.post")).default;
    const a = await create(mockEvent({ name: "Gold Ring!" }));
    const b = await create(mockEvent({ name: "Gold Ring" }));
    expect(a.$id).toBe("gold-ring");
    expect(b.$id).toBe("gold-ring-2");
    const [row] = await db.select().from(decorations).where(eq(decorations.id, "gold-ring"));
    expect(row.enabled).toBe(false);
    expect(row.type).toBe("layered");
  });

  it("create builds the chosen starter, or copies another decoration's stack", async () => {
    const create = (await import("~/server/api/admin/decorations/index.post")).default;
    await create(mockEvent({ name: "Sparkly", starter: "sparkles" }));
    const [sparkly] = await db.select().from(decorations).where(eq(decorations.id, "sparkly"));
    expect(sparkly.layers?.layers.map((l) => l.type)).toEqual(["particles"]);

    await create(mockEvent({ name: "Sparkly Two", copyFrom: "sparkly" }));
    const [copy] = await db.select().from(decorations).where(eq(decorations.id, "sparkly-two"));
    expect(copy.layers).toEqual(sparkly.layers);

    await expect(create(mockEvent({ name: "X", copyFrom: "missing" }))).rejects.toMatchObject({ statusCode: 404 });
  });

  it("update normalises layers and deletes only assets nobody references any more", async () => {
    const img = (key: string) => ({ type: "image", id: key, asset: { key, format: "png" } });
    await db.insert(decorations).values([
      { id: "a", name: "A", description: "", type: "layered", rarity: "common",
        layers: { v: 1, layers: [img("deco-1-a.png"), img("deco-2-shared.png")] } as never },
      { id: "b", name: "B", description: "", type: "layered", rarity: "common",
        layers: { v: 1, layers: [img("deco-2-shared.png")] } as never },
    ]);
    const put = (await import("~/server/api/admin/decorations/[id].put")).default;
    const result = await put(mockEvent({ layers: { v: 1, layers: [{ type: "glow", id: "g", spread: 5 }] } }, { id: "a" }));

    expect(result.layers.layers[0]).toMatchObject({ type: "glow", spread: 0.6 });
    expect(deletedKeys()).toEqual(["deco-1-a.png"]);
    expect(result.deletedAssets).toEqual(["deco-1-a.png"]);
  });

  it("update of a legacy row deletes the image it replaced", async () => {
    await db.insert(decorations).values({
      id: "old", name: "Old", description: "", type: "attachment", rarity: "common",
      imageKey: "legacy-hat.png", imageFormat: "png",
    });
    const put = (await import("~/server/api/admin/decorations/[id].put")).default;
    await put(mockEvent({
      layers: { v: 1, layers: [{ type: "image", id: "i", asset: { key: "deco-9-new.png", format: "png" } }] },
    }, { id: "old" }));
    expect(deletedKeys()).toEqual(["legacy-hat.png"]);
  });

  it("update rejects an empty body and an unknown id", async () => {
    const put = (await import("~/server/api/admin/decorations/[id].put")).default;
    await expect(put(mockEvent({}, { id: "nope" }))).rejects.toMatchObject({ statusCode: 404 });
    await db.insert(decorations).values({ id: "x", name: "X", description: "", type: "layered", rarity: "common" });
    await expect(put(mockEvent({ bogus: 1 }, { id: "x" }))).rejects.toMatchObject({ statusCode: 400 });
  });

  it("delete refuses with 409 while anyone owns the decoration", async () => {
    await db.insert(decorations).values({ id: "owned", name: "Owned", description: "", type: "layered", rarity: "rare" });
    await db.insert(userDecorations).values({ userId: currentUserId, decorationId: "owned", source: "purchase" });
    const del = (await import("~/server/api/admin/decorations/[id].delete")).default;
    await expect(del(mockEvent(undefined, { id: "owned" }))).rejects.toMatchObject({ statusCode: 409 });
    expect(await db.select().from(decorations).where(eq(decorations.id, "owned"))).toHaveLength(1);
  });

  it("force delete unequips it, drops ownership, and deletes its assets", async () => {
    await db.insert(decorations).values({
      id: "doomed", name: "Doomed", description: "", type: "layered", rarity: "rare",
      layers: { v: 1, layers: [{ type: "image", id: "i", asset: { key: "deco-3-doomed.png", format: "png" } }] } as never,
    });
    await db.insert(userDecorations).values({ userId: currentUserId, decorationId: "doomed", source: "purchase" });
    await db.update(users).set({ activeDecoration: "doomed" }).where(eq(users.id, currentUserId));

    const del = (await import("~/server/api/admin/decorations/[id].delete")).default;
    const result = await del(mockEvent(undefined, { id: "doomed" }, { force: "1" }));

    expect(result.deletedAssets).toEqual(["deco-3-doomed.png"]);
    const [user] = await db.select().from(users).where(eq(users.id, currentUserId));
    expect(user.activeDecoration).toBeNull();
    expect(await db.select().from(userDecorations).where(eq(userDecorations.decorationId, "doomed"))).toHaveLength(0);
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

  it("owners lists who holds a decoration, newest first", async () => {
    await db.insert(decorations).values({ id: "crown", name: "Crown", description: "", type: "layered", rarity: "epic" });
    const [other] = await db.insert(users).values({ name: "Zed" }).returning();
    await db.insert(userDecorations).values([
      { userId: currentUserId, decorationId: "crown", source: "admin_grant", acquiredAt: new Date("2026-01-01") },
      { userId: other.id, decorationId: "crown", source: "purchase", acquiredAt: new Date("2026-02-01") },
    ]);
    const handler = (await import("~/server/api/admin/decorations/[id]/owners.get")).default;
    const owners = await handler(mockEvent(undefined, { id: "crown" }));
    expect(owners.map((o) => [o.name, o.source])).toEqual([["Zed", "purchase"], ["U", "admin_grant"]]);
  });

  it("prune deletes only old, unreferenced deco- objects", async () => {
    const old = new Date(Date.now() - 48 * 3600 * 1000);
    await db.insert(decorations).values({
      id: "keep", name: "Keep", description: "", type: "layered", rarity: "common",
      layers: { v: 1, layers: [{ type: "image", id: "i", asset: { key: "deco-used.png", format: "png" } }] } as never,
    });
    r2Send.mockImplementation(async (cmd) =>
      cmd instanceof ListObjectsV2Command
        ? {
            IsTruncated: false,
            Contents: [
              { Key: "deco-old-orphan.png", LastModified: old },
              { Key: "deco-fresh-orphan.png", LastModified: new Date() },
              { Key: "deco-used.png", LastModified: old },
            ],
          }
        : {},
    );
    const handler = (await import("~/server/api/admin/decorations/assets/prune.post")).default;
    const result = await handler(mockEvent());

    expect(result).toEqual({ scanned: 3, deleted: 1 });
    const list = r2Send.mock.calls.find(([c]) => c instanceof ListObjectsV2Command)?.[0];
    expect(list.input.Prefix).toBe("deco-");
    // deletedKeys() skips the list call (it has no Key), leaving only deletes.
    expect(deletedKeys()).toEqual(["deco-old-orphan.png"]);
  });

  it("prune follows continuation tokens across pages", async () => {
    const old = new Date(Date.now() - 48 * 3600 * 1000);
    let call = 0;
    r2Send.mockImplementation(async (cmd) => {
      if (!(cmd instanceof ListObjectsV2Command)) return {};
      call++;
      if (call === 1) {
        return {
          IsTruncated: true,
          NextContinuationToken: "t2",
          Contents: [{ Key: "deco-a.png", LastModified: old }],
        };
      }
      return { IsTruncated: false, Contents: [{ Key: "deco-b.png", LastModified: old }] };
    });
    const handler = (await import("~/server/api/admin/decorations/assets/prune.post")).default;
    const result = await handler(mockEvent());

    expect(result).toEqual({ scanned: 2, deleted: 2 });
    const listCalls = r2Send.mock.calls.filter(([c]) => c instanceof ListObjectsV2Command);
    expect(listCalls[1][0].input.ContinuationToken).toBe("t2");
    expect(deletedKeys()).toEqual(["deco-a.png", "deco-b.png"]);
  });

  it("prune keeps going when one delete fails", async () => {
    const old = new Date(Date.now() - 48 * 3600 * 1000);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    r2Send.mockImplementation(async (cmd) => {
      if (cmd instanceof ListObjectsV2Command) {
        return {
          IsTruncated: false,
          Contents: [
            { Key: "deco-fails.png", LastModified: old },
            { Key: "deco-ok.png", LastModified: old },
          ],
        };
      }
      if (cmd.input?.Key === "deco-fails.png") throw new Error("transient R2 error");
      return {};
    });
    const handler = (await import("~/server/api/admin/decorations/assets/prune.post")).default;

    await expect(handler(mockEvent())).resolves.toEqual({ scanned: 2, deleted: 1 });

    errorSpy.mockRestore();
  });
});
