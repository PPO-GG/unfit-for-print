import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { whiteCards, blackCards } from "~/server/db/schema";

const db = useDb();

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return { ...actual, requireAdmin: async () => "admin-user" };
});

function mockEvent(body?: unknown, params: Record<string, string> = {}) {
  globalThis.readBody = async () => body;
  globalThis.getRouterParam = (_e: unknown, name: string) => params[name];
  return {} as any;
}

beforeEach(async () => {
  await db.delete(whiteCards);
  await db.delete(blackCards);
});

describe("card image columns", () => {
  it("persists imageKey, imageFormat, and attachment on a white card", async () => {
    const [created] = await db
      .insert(whiteCards)
      .values({
        text: null,
        pack: "Memes Vol 1",
        imageKey: "abc123-doge.webp",
        imageFormat: "webp",
        attachment: { offsetX: 0.1, offsetY: -0.2, scale: 1.5 },
      })
      .returning();

    const [row] = await db.select().from(whiteCards).where(eq(whiteCards.id, created.id));
    expect(row.text).toBeNull();
    expect(row.imageKey).toBe("abc123-doge.webp");
    expect(row.imageFormat).toBe("webp");
    expect(row.attachment).toEqual({ offsetX: 0.1, offsetY: -0.2, scale: 1.5 });
  });

  it("persists imageKey, imageFormat, and attachment on a black card", async () => {
    const [created] = await db
      .insert(blackCards)
      .values({
        text: null,
        pack: "Memes Vol 1",
        pick: 1,
        imageKey: "def456-caption-this.webp",
        imageFormat: "webp",
        attachment: { offsetX: 0, offsetY: 0, scale: 1 },
      })
      .returning();

    const [row] = await db.select().from(blackCards).where(eq(blackCards.id, created.id));
    expect(row.imageKey).toBe("def456-caption-this.webp");
    expect(row.attachment).toEqual({ offsetX: 0, offsetY: 0, scale: 1 });
  });

  it("leaves imageKey/imageFormat/attachment null for a text-only card", async () => {
    const [created] = await db
      .insert(whiteCards)
      .values({ text: "A regular text card.", pack: "Base" })
      .returning();

    const [row] = await db.select().from(whiteCards).where(eq(whiteCards.id, created.id));
    expect(row.imageKey).toBeNull();
    expect(row.imageFormat).toBeNull();
    expect(row.attachment).toBeNull();
  });
});

describe("card create/edit admin API image fields", () => {
  it("create.post persists an image card and rejects text+image together", async () => {
    const createHandler = (await import("~/server/api/admin/cards/create.post")).default;

    const created = await createHandler(
      mockEvent({
        type: "white",
        pack: "Memes Vol 1",
        imageFileId: "abc-doge.webp",
        imageFormat: "webp",
        attachment: { offsetX: 0, offsetY: 0, scale: 1.2 },
      }),
    );
    expect(created.text).toBeNull();
    expect(created.imageKey).toBe("abc-doge.webp");
    expect(created.attachment).toEqual({ offsetX: 0, offsetY: 0, scale: 1.2 });

    await expect(
      createHandler(
        mockEvent({
          type: "white",
          pack: "Memes Vol 1",
          text: "Both?",
          imageFileId: "abc-doge.webp",
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("create.post rejects a card with neither text nor an image", async () => {
    const createHandler = (await import("~/server/api/admin/cards/create.post")).default;
    await expect(
      createHandler(mockEvent({ type: "white", pack: "Memes Vol 1" })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("edit.post switches a text card to an image card", async () => {
    const createHandler = (await import("~/server/api/admin/cards/create.post")).default;
    const editHandler = (await import("~/server/api/admin/cards/edit.post")).default;

    const created = await createHandler(
      mockEvent({ type: "black", pack: "Base", text: "Original text.", pick: 1 }),
    );

    const updated = await editHandler(
      mockEvent({
        id: created.id,
        type: "black",
        imageFileId: "def-caption.webp",
        imageFormat: "webp",
        attachment: { offsetX: 0.1, offsetY: 0, scale: 1 },
      }),
    );
    expect(updated.text).toBeNull();
    expect(updated.imageKey).toBe("def-caption.webp");
  });

  it("resolve.post returns image fields alongside text", async () => {
    const createHandler = (await import("~/server/api/admin/cards/create.post")).default;
    const resolveHandler = (await import("~/server/api/cards/resolve.post")).default;

    const created = await createHandler(
      mockEvent({
        type: "white",
        pack: "Memes Vol 1",
        imageFileId: "xyz-meme.webp",
        imageFormat: "webp",
        attachment: { offsetX: 0, offsetY: 0, scale: 1 },
      }),
    );

    const [resolved] = await resolveHandler(mockEvent({ ids: [created.id], type: "white" }));
    expect(resolved.imageKey).toBe("xyz-meme.webp");
    expect(resolved.attachment).toEqual({ offsetX: 0, offsetY: 0, scale: 1 });
  });
});
