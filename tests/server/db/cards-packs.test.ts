import { describe, it, expect, beforeEach } from "vitest";
import { useDb } from "~/server/db/client";
import { whiteCards, blackCards } from "~/server/db/schema";
import handler from "~/server/api/cards/packs.get";

const db = useDb();

beforeEach(async () => {
  await db.delete(whiteCards);
  await db.delete(blackCards);
});

describe("GET /api/cards/packs", () => {
  it("groups cards by pack with total/active counts per card type", async () => {
    await db.insert(whiteCards).values([
      { text: "a", pack: "Base", active: true },
      { text: "b", pack: "Base", active: false },
      { text: "c", pack: "Expansion", active: true },
    ]);
    await db.insert(blackCards).values([
      { text: "d?", pack: "Base", active: true, pick: 1 },
    ]);

    const result = await handler({} as any);

    expect(result.white).toEqual(
      expect.arrayContaining([
        { pack: "Base", total: 2, active: 1 },
        { pack: "Expansion", total: 1, active: 1 },
      ]),
    );
    expect(result.black).toEqual([{ pack: "Base", total: 1, active: 1 }]);
  });
});
