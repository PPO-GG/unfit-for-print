import { describe, it, expect, beforeEach } from "vitest";
import { useDb } from "~/server/db/client";
import { whiteCards, blackCards } from "~/server/db/schema";
import handler from "~/server/api/cards/packs.get";

const db = useDb();

beforeEach(async () => {
  await db.delete(whiteCards);
  await db.delete(blackCards);
});

function mockEvent(query: Record<string, string> = {}) {
  globalThis.getQuery = () => query;
  return {} as any;
}

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

    const result = await handler(mockEvent());

    expect(result.white).toEqual(
      expect.arrayContaining([
        { pack: "Base", total: 2, active: 1 },
        { pack: "Expansion", total: 1, active: 1 },
      ]),
    );
    expect(result.black).toEqual([{ pack: "Base", total: 1, active: 1 }]);
  });

  it("still reports fully deactivated packs by default, for the admin manager", async () => {
    await db.insert(whiteCards).values([
      { text: "retired", pack: "Retired", active: false },
      { text: "live", pack: "Live", active: true },
    ]);

    const result = await handler(mockEvent());

    expect(result.white.map((p) => p.pack).sort()).toEqual(["Live", "Retired"]);
  });

  it("omits fully deactivated packs when activeOnly is requested", async () => {
    await db.insert(whiteCards).values([
      { text: "retired", pack: "Retired", active: false },
      { text: "live", pack: "Live", active: true },
    ]);
    await db.insert(blackCards).values([
      { text: "retired?", pack: "Retired", active: false, pick: 1 },
    ]);

    const result = await handler(mockEvent({ activeOnly: "1" }));

    expect(result.white).toEqual([{ pack: "Live", total: 1, active: 1 }]);
    expect(result.black).toEqual([]);
  });

  it("keeps a partially deactivated pack when activeOnly is requested", async () => {
    await db.insert(whiteCards).values([
      { text: "live", pack: "Mixed", active: true },
      { text: "retired", pack: "Mixed", active: false },
    ]);

    const result = await handler(mockEvent({ activeOnly: "1" }));

    expect(result.white).toEqual([{ pack: "Mixed", total: 2, active: 1 }]);
  });

  it("drops a pack from only the card type that has no active cards", async () => {
    await db.insert(whiteCards).values({ text: "live", pack: "Base", active: true });
    await db.insert(blackCards).values({ text: "off?", pack: "Base", active: false, pick: 1 });

    const result = await handler(mockEvent({ activeOnly: "1" }));

    expect(result.white.map((p) => p.pack)).toEqual(["Base"]);
    expect(result.black).toEqual([]);
  });
});
