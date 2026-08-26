import { describe, it, expect, beforeEach } from "vitest";
import { useDb } from "~/server/db/client";
import { blackCards, whiteCards } from "~/server/db/schema";
import handler from "~/server/api/cards/resolve.post";

const db = useDb();

beforeEach(async () => {
  await db.delete(whiteCards);
  await db.delete(blackCards);
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
