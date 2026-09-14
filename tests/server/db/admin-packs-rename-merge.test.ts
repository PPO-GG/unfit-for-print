import { describe, it, expect, beforeEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { useDb } from "~/server/db/client";
import { whiteCards, blackCards, cardPacks, users } from "~/server/db/schema";
import { resetCardTables, seedPack, insertCards, packNamesOf } from "./helpers/cards";

const db = useDb();
let adminId: string;

vi.mock("~/server/utils/session", () => ({
  requireAdmin: async () => adminId,
}));

function mockEvent(body: unknown) {
  globalThis.readBody = async () => body;
  return {} as any;
}

const rename = async (body: unknown) =>
  (await import("~/server/api/admin/cards/rename-pack.post")).default(mockEvent(body));
const merge = async (body: unknown) =>
  (await import("~/server/api/admin/cards/merge-packs.post")).default(mockEvent(body));

beforeEach(async () => {
  await resetCardTables();
  await db.delete(users);
  const [admin] = await db.insert(users).values({ name: "Admin", isAdmin: true }).returning();
  adminId = admin.id;
});

describe("POST /api/admin/cards/rename-pack", () => {
  it("renames in place: same id, cards untouched, metadata kept", async () => {
    await insertCards(whiteCards, { text: "w", pack: "CAH Base Set" });
    const id = await seedPack("CAH Base Set", { description: "the original", isDefault: true });

    const row = await rename({ id, name: "Base Set" });

    expect(row).toMatchObject({ id, pack: "Base Set", description: "the original", isDefault: true });
    expect(await packNamesOf(whiteCards)).toEqual(["Base Set"]);
  });

  it("409s when the name belongs to another pack", async () => {
    const id = await seedPack("A");
    await seedPack("B");
    await expect(rename({ id, name: "B" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("400s a non-id and a blank name", async () => {
    await expect(rename({ id: "A", name: "B" })).rejects.toMatchObject({ statusCode: 400 });
    const id = await seedPack("A");
    await expect(rename({ id, name: "  " })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("404s an unknown id", async () => {
    await expect(rename({ id: randomUUID(), name: "X" })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("POST /api/admin/cards/merge-packs", () => {
  it("moves every source's cards into the target and removes the sources", async () => {
    await insertCards(whiteCards, [
      { text: "r", pack: "Red" },
      { text: "b", pack: "Blue" },
    ]);
    await insertCards(blackCards, { text: "rb", pack: "Red" });
    const target = await seedPack("Base", { description: "wins" });
    const red = await seedPack("Red", { isDefault: true });
    const blue = await seedPack("Blue");

    const result = await merge({ sourceIds: [red, blue], targetId: target });

    expect(result.moved).toEqual({ white: 2, black: 1 });
    expect(result.target).toMatchObject({ id: target, pack: "Base", description: "wins", isDefault: false });
    expect(await packNamesOf(whiteCards)).toEqual(["Base", "Base"]);
    expect((await db.select().from(cardPacks)).map((p) => p.id)).toEqual([target]);
  });

  it("400s missing or malformed ids", async () => {
    const target = await seedPack("Base");
    await expect(merge({ sourceIds: [], targetId: target })).rejects.toMatchObject({ statusCode: 400 });
    await expect(merge({ sourceIds: ["Red"], targetId: target })).rejects.toMatchObject({ statusCode: 400 });
    await expect(merge({ sourceIds: [target], targetId: "Base" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("404s an unknown target and moves nothing", async () => {
    await insertCards(whiteCards, { text: "r", pack: "Red" });
    const red = await seedPack("Red");

    await expect(merge({ sourceIds: [red], targetId: randomUUID() })).rejects.toMatchObject({ statusCode: 404 });
    expect(await packNamesOf(whiteCards)).toEqual(["Red"]);
  });
});
