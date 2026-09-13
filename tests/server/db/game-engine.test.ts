import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { whiteCards, cardPacks } from "~/server/db/schema";
import { fetchAllIds, shuffle } from "~/server/utils/game-engine";
import { resetCardTables, insertCards, seedPack } from "./helpers/cards";

const db = useDb();

beforeEach(async () => {
  await resetCardTables();
});

describe("fetchAllIds", () => {
  it("returns only active cards, filtered by pack when given", async () => {
    await insertCards(whiteCards, [
      { text: "a", pack: "Base", active: true },
      { text: "b", pack: "Base", active: false },
      { text: "c", pack: "Other", active: true },
    ]);

    const ids = await fetchAllIds(whiteCards, ["Base"]);
    expect(ids).toHaveLength(1);
  });

  it("returns all active cards when no pack filter given", async () => {
    await insertCards(whiteCards, [
      { text: "a", pack: "Base", active: true },
      { text: "b", pack: "Other", active: true },
    ]);

    const ids = await fetchAllIds(whiteCards);
    expect(ids).toHaveLength(2);
  });

  it("filters by pack id as well as by a legacy pack name", async () => {
    await insertCards(whiteCards, [
      { text: "a", pack: "Base", active: true },
      { text: "c", pack: "Other", active: true },
    ]);
    const baseId = await seedPack("Base");

    expect(await fetchAllIds(whiteCards, [baseId])).toHaveLength(1);
    expect(await fetchAllIds(whiteCards, ["Base"])).toHaveLength(1);
    expect(await fetchAllIds(whiteCards, [baseId, "Other"])).toHaveLength(2);
  });

  it("deals nothing when every selected pack is unknown, instead of every card", async () => {
    await insertCards(whiteCards, { text: "a", pack: "Base", active: true });

    expect(await fetchAllIds(whiteCards, ["Deleted Pack"])).toEqual([]);
  });

  it("still deals from a pack after it is renamed, when selected by id", async () => {
    await insertCards(whiteCards, { text: "a", pack: "Old", active: true });
    const id = await seedPack("Old");
    await db.update(cardPacks).set({ name: "New" }).where(eq(cardPacks.id, id));

    expect(await fetchAllIds(whiteCards, [id])).toHaveLength(1);
  });
});

describe("shuffle", () => {
  it("preserves all elements", () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle([...input]);
    expect(result.sort()).toEqual(input);
  });
});
