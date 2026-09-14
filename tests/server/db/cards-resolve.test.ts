import { describe, it, expect, beforeEach } from "vitest";
import handler from "~/server/api/cards/resolve.post";
import { resetCardTables, insertCards, seedPack } from "./helpers/cards";
import { whiteCards, blackCards } from "~/server/db/schema";

beforeEach(async () => {
  await resetCardTables();
});

function mockEvent(body: unknown) {
  return { node: {} } as any;
}

describe("POST /api/cards/resolve", () => {
  it("resolves ids to text/pack, silently dropping ids not found", async () => {
    const [a, b] = await insertCards(whiteCards, [
      { text: "Card A", pack: "Base" },
      { text: "Card B", pack: "Base" },
    ]);

    globalThis.readBody = async () => ({
      ids: [a.id, b.id, "00000000-0000-0000-0000-000000000000"],
    });
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
    const [a] = await insertCards(whiteCards, { text: "Card A", pack: "Base" });

    globalThis.readBody = async () => ({ ids: [a.id] });
    const result = await handler(mockEvent({ ids: [a.id] }));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: a.id, text: "Card A", pack: "Base" });
    expect(result[0]).not.toHaveProperty("pick");
  });

  it("resolves black cards with their pick value when type is 'black'", async () => {
    const [blk] = await insertCards(blackCards, {
      text: "Fill in the blank ___",
      pack: "Base",
      pick: 2,
    });

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
// down with the text. A left join keeps the contract intact for the packs
// that have no card_packs row at all.
describe("POST /api/cards/resolve pack labelling", () => {
  it("returns the pack's current name, id and series alongside the text", async () => {
    const packId = await seedPack("Base Pack", { series: "Cards Against Humanity" });
    const [a] = await insertCards(whiteCards, { text: "Card A", pack: "Base Pack" });

    globalThis.readBody = async () => ({ ids: [a.id] });
    const result = await handler(mockEvent({ ids: [a.id] }));

    expect(result[0]).toMatchObject({
      pack: "Base Pack",
      packId,
      packSeries: "Cards Against Humanity",
    });
    expect(result[0]).not.toHaveProperty("packDisplayName");
  });

  it("keeps a card with no pack, with null label fields", async () => {
    const [a] = await insertCards(whiteCards, { text: "Card A", pack: null });

    globalThis.readBody = async () => ({ ids: [a.id] });
    const result = await handler(mockEvent({ ids: [a.id] }));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ text: "Card A", pack: null, packId: null, packSeries: null });
  });

  it("labels black cards too, keeping pick", async () => {
    await seedPack("Base Pack", { series: "Cards Against Humanity" });
    const [blk] = await insertCards(blackCards, { text: "Why? ___", pack: "Base Pack", pick: 2 });

    globalThis.readBody = async () => ({ ids: [blk.id], type: "black" });
    const result = await handler(mockEvent({ ids: [blk.id], type: "black" }));

    expect(result[0]).toMatchObject({ pick: 2, pack: "Base Pack", packSeries: "Cards Against Humanity" });
  });
});
