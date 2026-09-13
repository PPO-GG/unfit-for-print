import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { whiteCards, blackCards, cardPacks } from "~/server/db/schema";
import {
  isPackId,
  resolvePackRefs,
  findPackId,
  ensurePackByName,
  packNameFor,
  renamePack,
  mergePacks,
  packCardCounts,
} from "~/server/utils/packs";
import { resetCardTables, seedPack, insertCards, packNamesOf } from "./helpers/cards";

const db = useDb();

beforeEach(resetCardTables);

describe("isPackId", () => {
  it("accepts uuids and rejects names", () => {
    expect(isPackId(randomUUID())).toBe(true);
    expect(isPackId("CAH Base Set")).toBe(false);
    expect(isPackId(42)).toBe(false);
  });
});

describe("resolvePackRefs", () => {
  it("resolves ids and names together, dropping unknown and blank refs", async () => {
    const base = await seedPack("Base");
    const blue = await seedPack("Blue");

    const ids = await resolvePackRefs(db, [base, "Blue", "Ghost", randomUUID(), "", null]);

    expect(ids.sort()).toEqual([base, blue].sort());
  });

  it("returns an empty list for no refs", async () => {
    expect(await resolvePackRefs(db, [])).toEqual([]);
  });

  it("findPackId returns null for an unknown ref", async () => {
    expect(await findPackId(db, "Nope")).toBeNull();
  });
});

describe("ensurePackByName", () => {
  it("creates a pack once and returns the same id after", async () => {
    const first = await ensurePackByName(db, "  Unfit Labs ");
    const second = await ensurePackByName(db, "Unfit Labs");

    expect(first).toBe(second);
    expect(await packNameFor(db, first)).toBe("Unfit Labs");
  });

  it("matches an existing name with internal double spaces exactly", async () => {
    const id = await seedPack("Cards Against Humanity  Nasty Bundle");
    expect(await ensurePackByName(db, "Cards Against Humanity  Nasty Bundle")).toBe(id);
  });

  it("rejects a blank name", async () => {
    await expect(ensurePackByName(db, "   ")).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("renamePack", () => {
  it("renames in place and keeps the id", async () => {
    const id = await seedPack("Old", { description: "keep" });

    const row = await renamePack(db, id, "  New   Name ");

    expect(row).toMatchObject({ id, name: "New Name", description: "keep" });
  });

  it("refuses a name another pack already has", async () => {
    const id = await seedPack("A");
    await seedPack("B");
    await expect(renamePack(db, id, "B")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("allows renaming a pack onto its own name", async () => {
    const id = await seedPack("Same");
    await expect(renamePack(db, id, "Same")).resolves.toMatchObject({ id, name: "Same" });
  });

  it("404s an unknown pack", async () => {
    await expect(renamePack(db, randomUUID(), "X")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("mergePacks", () => {
  it("repoints both card tables, deletes the sources and keeps the target row", async () => {
    await insertCards(whiteCards, [
      { text: "w1", pack: "Red" },
      { text: "w2", pack: "Blue" },
      { text: "w3", pack: "Base" },
    ]);
    await insertCards(blackCards, { text: "b1", pack: "Red" });
    const target = await seedPack("Base", { description: "target wins", isDefault: true });
    const red = await seedPack("Red", { description: "discarded" });
    const blue = await seedPack("Blue");

    const moved = await db.transaction((tx) => mergePacks(tx, [red, blue, target], target));

    expect(moved).toEqual({ white: 2, black: 1 });
    expect(await packNamesOf(whiteCards)).toEqual(["Base", "Base", "Base"]);
    expect(await packNamesOf(blackCards)).toEqual(["Base"]);
    const packs = await db.select().from(cardPacks);
    expect(packs).toHaveLength(1);
    expect(packs[0]).toMatchObject({ id: target, description: "target wins", isDefault: true });
  });

  it("404s an unknown target without touching cards", async () => {
    await insertCards(whiteCards, { text: "w", pack: "Red" });
    const red = await seedPack("Red");

    await expect(mergePacks(db, [red], randomUUID())).rejects.toMatchObject({ statusCode: 404 });
    expect(await packNamesOf(whiteCards)).toEqual(["Red"]);
  });
});

describe("packCardCounts", () => {
  it("counts cards per table", async () => {
    await insertCards(whiteCards, [{ text: "a", pack: "P" }, { text: "b", pack: "P" }]);
    await insertCards(blackCards, { text: "c", pack: "P" });
    const id = await seedPack("P");

    expect(await packCardCounts(db, id)).toEqual({ white: 2, black: 1 });
  });
});
