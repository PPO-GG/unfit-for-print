import { describe, it, expect, beforeEach } from "vitest";
import { useDb } from "~/server/db/client";
import { blackCards, cardPacks, whiteCards } from "~/server/db/schema";
import handler from "~/server/api/cards/resolve.post";

const db = useDb();

beforeEach(async () => {
  await db.delete(whiteCards);
  await db.delete(blackCards);
  await db.delete(cardPacks);
});

function mockEvent(body: unknown) {
  return { node: {} } as any;
}

describe("POST /api/cards/resolve", () => {
  it("resolves ids to text/pack, silently dropping ids not found", async () => {
    const [a, b] = await db
      .insert(whiteCards)
      .values([
        { text: "Card A", pack: "Base" },
        { text: "Card B", pack: "Base" },
      ])
      .returning();

    globalThis.readBody = async () => ({ ids: [a.id, b.id, "00000000-0000-0000-0000-000000000000"] });
    const result = await handler(mockEvent({ ids: [a.id, b.id] }));

    expect(result).toHaveLength(2);
    expect(result.map((c: any) => c.text).sort()).toEqual(["Card A", "Card B"]);
  });

  it("caps input at 500 ids", async () => {
    const tooMany = Array.from({ length: 501 }, () => crypto.randomUUID());
    globalThis.readBody = async () => ({ ids: tooMany });
    await expect(handler(mockEvent({ ids: tooMany }))).rejects.toMatchObject({ statusCode: 400 });
  });

  it("defaults to white cards when type is omitted, with no pick field", async () => {
    const [a] = await db
      .insert(whiteCards)
      .values([{ text: "Card A", pack: "Base" }])
      .returning();

    globalThis.readBody = async () => ({ ids: [a.id] });
    const result = await handler(mockEvent({ ids: [a.id] }));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: a.id, text: "Card A", pack: "Base" });
    expect(result[0]).not.toHaveProperty("pick");
  });

  it("resolves black cards with their pick value when type is 'black'", async () => {
    const [blk] = await db
      .insert(blackCards)
      .values([{ text: "Fill in the blank ___", pack: "Base", pick: 2 }])
      .returning();

    globalThis.readBody = async () => ({ ids: [blk.id], type: "black" });
    const result = await handler(mockEvent({ ids: [blk.id], type: "black" }));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: blk.id,
      text: "Fill in the blank ___",
      pack: "Base",
      pick: 2,
    });
  });
});

// The card face renders its pack in the footer, and a single card has no
// roster to derive a series prefix from — so the label metadata has to come
// down with the text. A left join keeps the contract intact for the ~106
// packs that have no card_packs row at all.
describe("POST /api/cards/resolve pack labelling", () => {
  it("returns the pack's display name and series alongside the text", async () => {
    await db.insert(cardPacks).values({
      pack: "CAH Base Set",
      displayName: "Base Pack",
      series: "Cards Against Humanity",
    });
    const [a] = await db
      .insert(whiteCards)
      .values([{ text: "Card A", pack: "CAH Base Set" }])
      .returning();

    globalThis.readBody = async () => ({ ids: [a.id] });
    const result = await handler(mockEvent({ ids: [a.id] }));

    expect(result[0]).toMatchObject({
      pack: "CAH Base Set",
      packDisplayName: "Base Pack",
      packSeries: "Cards Against Humanity",
    });
  });

  it("returns null label fields for a pack with no metadata row", async () => {
    const [a] = await db
      .insert(whiteCards)
      .values([{ text: "Card A", pack: "Unfit Labs" }])
      .returning();

    globalThis.readBody = async () => ({ ids: [a.id] });
    const result = await handler(mockEvent({ ids: [a.id] }));

    // The join must not drop the card — this is the common case by a wide
    // margin, and an inner join here would empty most players' hands.
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      text: "Card A",
      pack: "Unfit Labs",
      packDisplayName: null,
      packSeries: null,
    });
  });

  it("labels black cards too, keeping pick", async () => {
    await db.insert(cardPacks).values({
      pack: "CAH Base Set",
      displayName: "Base Pack",
      series: "Cards Against Humanity",
    });
    const [blk] = await db
      .insert(blackCards)
      .values([{ text: "Why? ___", pack: "CAH Base Set", pick: 2 }])
      .returning();

    globalThis.readBody = async () => ({ ids: [blk.id], type: "black" });
    const result = await handler(mockEvent({ ids: [blk.id], type: "black" }));

    expect(result[0]).toMatchObject({
      pick: 2,
      packDisplayName: "Base Pack",
      packSeries: "Cards Against Humanity",
    });
  });
});
