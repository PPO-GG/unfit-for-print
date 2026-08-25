import { describe, it, expect, beforeEach } from "vitest";
import { useDb } from "~/server/db/client";
import { whiteCards } from "~/server/db/schema";
import handler from "~/server/api/cards/resolve.post";

const db = useDb();

beforeEach(async () => {
  await db.delete(whiteCards);
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
});
