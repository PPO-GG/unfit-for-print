import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import {
  whiteCards,
  blackCards,
  defaultCardPacks,
  cardPacks,
  users,
} from "~/server/db/schema";

const db = useDb();
let adminId: string;

vi.mock("~/server/utils/session", () => ({
  requireAdmin: async () => adminId,
}));

function mockEvent(body: unknown) {
  globalThis.readBody = async () => body;
  return {} as any;
}

beforeEach(async () => {
  await db.delete(cardPacks);
  await db.delete(defaultCardPacks);
  await db.delete(whiteCards);
  await db.delete(blackCards);
  await db.delete(users);
  const [admin] = await db
    .insert(users)
    .values({ name: "Admin", isAdmin: true })
    .returning();
  adminId = admin.id;
});

describe("GET /api/admin/cards/pack-meta", () => {
  it("returns every metadata row", async () => {
    await db.insert(cardPacks).values([
      { pack: "Base", description: "the original" },
      { pack: "Blue", icon: "🟦" },
    ]);

    const handler = (await import("~/server/api/admin/cards/pack-meta.get")).default;
    const result = await handler({} as any);

    expect(result.packs.map((p: { pack: string }) => p.pack).sort()).toEqual(["Base", "Blue"]);
  });

  it("returns an empty list when no pack has metadata", async () => {
    const handler = (await import("~/server/api/admin/cards/pack-meta.get")).default;
    const result = await handler({} as any);
    expect(result.packs).toEqual([]);
  });
});

describe("POST /api/admin/cards/pack-meta", () => {
  it("inserts a row for a pack that had none", async () => {
    const handler = (await import("~/server/api/admin/cards/pack-meta.post")).default;
    const row = await handler(mockEvent({ pack: "Base", description: "the original" }));

    expect(row.pack).toBe("Base");
    expect(row.description).toBe("the original");
    expect(row.sortOrder).toBe(0);
  });

  it("updates an existing row without clobbering untouched fields", async () => {
    await db.insert(cardPacks).values({ pack: "Base", description: "keep", icon: "🎴" });

    const handler = (await import("~/server/api/admin/cards/pack-meta.post")).default;
    const row = await handler(mockEvent({ pack: "Base", nsfw: true }));

    expect(row.nsfw).toBe(true);
    expect(row.description).toBe("keep");
    expect(row.icon).toBe("🎴");
  });

  it("rejects a missing pack name", async () => {
    const handler = (await import("~/server/api/admin/cards/pack-meta.post")).default;
    await expect(handler(mockEvent({ description: "orphan" }))).rejects.toThrow(/pack/i);
  });

  it("creates an empty row when the body carries only the pack name", async () => {
    const handler = (await import("~/server/api/admin/cards/pack-meta.post")).default;
    const row = await handler(mockEvent({ pack: "Bare" }));

    expect(row.pack).toBe("Bare");
    expect(row.description).toBeNull();
    expect(row.sortOrder).toBe(0);
  });

  it("sets the series field without touching other columns", async () => {
    await db.insert(cardPacks).values({ pack: "Base", description: "keep" });

    const handler = (await import("~/server/api/admin/cards/pack-meta.post")).default;
    const row = await handler(mockEvent({ pack: "Base", series: "Cards Against Humanity" }));

    expect(row.series).toBe("Cards Against Humanity");
    expect(row.description).toBe("keep");
  });
});

describe("POST /api/admin/cards/pack-meta-bulk", () => {
  it("upserts series across packs that have no metadata row yet", async () => {
    const handler = (await import("~/server/api/admin/cards/pack-meta-bulk.post")).default;
    const result = await handler(
      mockEvent({ packs: ["A", "B"], series: "Cards Against Humanity" }),
    );

    expect(result.packs.map((p: { pack: string }) => p.pack).sort()).toEqual(["A", "B"]);
    expect(result.packs.every((p: { series: string }) => p.series === "Cards Against Humanity")).toBe(true);
  });

  it("updates series on an existing row without clobbering other fields", async () => {
    await db.insert(cardPacks).values({ pack: "Base", description: "keep", icon: "🎴" });

    const handler = (await import("~/server/api/admin/cards/pack-meta-bulk.post")).default;
    const [row] = (await handler(mockEvent({ packs: ["Base"], series: "Unfit for Print" }))).packs;

    expect(row.series).toBe("Unfit for Print");
    expect(row.description).toBe("keep");
    expect(row.icon).toBe("🎴");
  });

  it("de-duplicates repeated pack names", async () => {
    const handler = (await import("~/server/api/admin/cards/pack-meta-bulk.post")).default;
    const result = await handler(mockEvent({ packs: ["A", "A"], series: "X" }));

    expect(result.packs).toHaveLength(1);
  });

  it("rejects an empty pack list", async () => {
    const handler = (await import("~/server/api/admin/cards/pack-meta-bulk.post")).default;
    await expect(handler(mockEvent({ packs: [], series: "X" }))).rejects.toThrow(/packs/i);
  });

  it("clears series when given an empty string", async () => {
    await db.insert(cardPacks).values({ pack: "Base", series: "Old Brand" });

    const handler = (await import("~/server/api/admin/cards/pack-meta-bulk.post")).default;
    const [row] = (await handler(mockEvent({ packs: ["Base"], series: "" }))).packs;

    expect(row.series).toBeNull();
  });
});

describe("POST /api/admin/cards/delete-pack — metadata cleanup", () => {
  it("clears the card_packs row when deleting the whole pack", async () => {
    await db.insert(whiteCards).values({ text: "w", pack: "Doomed" });
    await db.insert(cardPacks).values({ pack: "Doomed" });

    const handler = (await import("~/server/api/admin/cards/delete-pack.post")).default;
    await handler(mockEvent({ pack: "Doomed", type: "all" }));

    expect(await db.select().from(cardPacks)).toEqual([]);
  });

  it("clears the card_packs row when a single-type delete empties the pack", async () => {
    await db.insert(whiteCards).values({ text: "w", pack: "WhiteOnly" });
    await db.insert(cardPacks).values({ pack: "WhiteOnly" });

    const handler = (await import("~/server/api/admin/cards/delete-pack.post")).default;
    await handler(mockEvent({ pack: "WhiteOnly", type: "white" }));

    expect(await db.select().from(cardPacks)).toEqual([]);
  });

  it("keeps the card_packs row when the other card type survives", async () => {
    await db.insert(whiteCards).values({ text: "w", pack: "Mixed" });
    await db.insert(blackCards).values({ text: "b", pack: "Mixed" });
    await db.insert(cardPacks).values({ pack: "Mixed", description: "still here" });

    const handler = (await import("~/server/api/admin/cards/delete-pack.post")).default;
    await handler(mockEvent({ pack: "Mixed", type: "white" }));

    const meta = await db.select().from(cardPacks).where(eq(cardPacks.pack, "Mixed"));
    expect(meta[0].description).toBe("still here");
  });
});

// Normalization sits on the route, not only the form: the form is not the
// only possible caller, and a bad value here is permanent in a UI that
// uppercases everything and so cannot show you what went wrong.
describe("pack metadata entry hygiene", () => {
  it("collapses internal whitespace in the hand-typed fields", async () => {
    const handler = (await import("~/server/api/admin/cards/pack-meta.post")).default;
    const row = await handler(
      mockEvent({
        pack: "Base",
        displayName: "  Nasty   Bundle ",
        series: "Cards Against  Humanity",
      }),
    );

    expect(row.displayName).toBe("Nasty Bundle");
    expect(row.series).toBe("Cards Against Humanity");
  });

  it("stores null for a field that is only whitespace", async () => {
    const handler = (await import("~/server/api/admin/cards/pack-meta.post")).default;
    const row = await handler(
      mockEvent({ pack: "Base", displayName: "   ", series: "	" }),
    );

    expect(row.displayName).toBeNull();
    expect(row.series).toBeNull();
  });

  it("leaves the pack key itself alone", async () => {
    // The key is the literal value on every card row. Collapsing its
    // whitespace here would point the metadata at a pack that does not
    // exist — renaming a key is move.post.ts's job, with its own confirm.
    const handler = (await import("~/server/api/admin/cards/pack-meta.post")).default;
    const row = await handler(
      mockEvent({ pack: "Cards Against Humanity  Nasty Bundle", displayName: "Nasty" }),
    );

    expect(row.pack).toBe("Cards Against Humanity  Nasty Bundle");
  });

  it("does not change casing", async () => {
    // Advisory in the form, never enforced — some pack names are acronyms.
    const handler = (await import("~/server/api/admin/cards/pack-meta.post")).default;
    const row = await handler(
      mockEvent({ pack: "Base", series: "CARDS AGAINST HUMANITY" }),
    );

    expect(row.series).toBe("CARDS AGAINST HUMANITY");
  });

  it("normalizes the bulk series too", async () => {
    // This one writes the field across ~106 rows at once.
    const handler = (await import("~/server/api/admin/cards/pack-meta-bulk.post")).default;
    const { packs } = await handler(
      mockEvent({ packs: ["A", "B"], series: "  Cards Against  Humanity " }),
    );

    expect(packs.map((p: any) => p.series)).toEqual([
      "Cards Against Humanity",
      "Cards Against Humanity",
    ]);
  });
});

