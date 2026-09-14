import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { whiteCards, blackCards, cardPacks } from "~/server/db/schema";
import handler from "~/server/api/cards/packs.get";
import { resetCardTables, insertCards, seedPack } from "./helpers/cards";

const db = useDb();

beforeEach(async () => {
  await resetCardTables();
});

function mockEvent(query: Record<string, string> = {}) {
  globalThis.getQuery = () => query;
  return {} as any;
}

describe("GET /api/cards/packs", () => {
  it("groups cards by pack with total/active counts per card type", async () => {
    await insertCards(whiteCards, [
      { text: "a", pack: "Base", active: true },
      { text: "b", pack: "Base", active: false },
      { text: "c", pack: "Expansion", active: true },
    ]);
    await insertCards(blackCards, [{ text: "d?", pack: "Base", active: true, pick: 1 }]);

    const result = await handler(mockEvent());

    expect(result.white).toEqual(
      expect.arrayContaining([
        { packId: expect.any(String), pack: "Base", total: 2, active: 1 },
        { packId: expect.any(String), pack: "Expansion", total: 1, active: 1 },
      ]),
    );
    expect(result.black).toEqual([
      { packId: expect.any(String), pack: "Base", total: 1, active: 1 },
    ]);
  });

  it("still reports fully deactivated packs by default, for the admin manager", async () => {
    await insertCards(whiteCards, [
      { text: "retired", pack: "Retired", active: false },
      { text: "live", pack: "Live", active: true },
    ]);

    const result = await handler(mockEvent());

    expect(result.white.map((p) => p.pack).sort()).toEqual(["Live", "Retired"]);
  });

  it("omits fully deactivated packs when activeOnly is requested", async () => {
    await insertCards(whiteCards, [
      { text: "retired", pack: "Retired", active: false },
      { text: "live", pack: "Live", active: true },
    ]);
    await insertCards(blackCards, [{ text: "retired?", pack: "Retired", active: false, pick: 1 }]);

    const result = await handler(mockEvent({ activeOnly: "1" }));

    expect(result.white).toEqual([{ packId: expect.any(String), pack: "Live", total: 1, active: 1 }]);
    expect(result.black).toEqual([]);
  });

  it("keeps a partially deactivated pack when activeOnly is requested", async () => {
    await insertCards(whiteCards, [
      { text: "live", pack: "Mixed", active: true },
      { text: "retired", pack: "Mixed", active: false },
    ]);

    const result = await handler(mockEvent({ activeOnly: "1" }));

    expect(result.white).toEqual([{ packId: expect.any(String), pack: "Mixed", total: 2, active: 1 }]);
  });

  it("drops a pack from only the card type that has no active cards", async () => {
    await insertCards(whiteCards, { text: "live", pack: "Base", active: true });
    await insertCards(blackCards, { text: "off?", pack: "Base", active: false, pick: 1 });

    const result = await handler(mockEvent({ activeOnly: "1" }));

    expect(result.white.map((p) => p.pack)).toEqual(["Base"]);
    expect(result.black).toEqual([]);
  });

  it("reports a renamed pack under its new name with the same id", async () => {
    await insertCards(whiteCards, { text: "a", pack: "Old", active: true });
    const id = await seedPack("Old");
    await db.update(cardPacks).set({ name: "New" }).where(eq(cardPacks.id, id));

    const result = await handler(mockEvent());

    expect(result.white).toEqual([{ packId: id, pack: "New", total: 1, active: 1 }]);
    expect(result.meta).toEqual([expect.objectContaining({ id, pack: "New" })]);
  });

  it("exposes a pack's pre-migration key as legacyKey, null for newer packs", async () => {
    const pretty = await seedPack("Pretty", { pack: "Raw Key" });
    const fresh = await seedPack("Fresh");

    const result = await handler(mockEvent());

    expect(result.meta).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: pretty, pack: "Pretty", legacyKey: "Raw Key" }),
        expect.objectContaining({ id: fresh, pack: "Fresh", legacyKey: null }),
      ]),
    );
  });
});
