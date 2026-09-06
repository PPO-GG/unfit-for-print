import { describe, it, expect, beforeEach } from "vitest";
import { useDb } from "~/server/db/client";
import { whiteCards, blackCards } from "~/server/db/schema";
import handler from "~/server/api/cards/browse.get";

const db = useDb();

beforeEach(async () => {
  await db.delete(whiteCards);
  await db.delete(blackCards);
});

function mockEvent(query: Record<string, string> = {}) {
  globalThis.getQuery = () => query;
  return {} as any;
}

describe("GET /api/cards/browse", () => {
  it("omits inactive cards so the browser only shows what can be dealt", async () => {
    await db.insert(whiteCards).values([
      { text: "dealt", pack: "Base", active: true },
      { text: "retired", pack: "Base", active: false },
    ]);

    const result = await handler(mockEvent({ pack: "Base" }));

    expect(result.total).toBe(1);
    expect(result.cards.map((c) => c.text)).toEqual(["dealt"]);
  });

  it("defaults to white cards when no type is given", async () => {
    await db.insert(whiteCards).values({ text: "a white one", active: true });
    await db.insert(blackCards).values({ text: "a black one?", active: true, pick: 1 });

    const result = await handler(mockEvent({}));

    expect(result.cards.map((c) => c.text)).toEqual(["a white one"]);
  });

  it("returns pick alongside black cards", async () => {
    await db.insert(blackCards).values({ text: "two blanks?", active: true, pick: 2 });

    const result = await handler(mockEvent({ type: "black" }));

    expect(result.cards[0]).toMatchObject({ text: "two blanks?", pick: 2 });
  });

  it("restricts results to the requested pack", async () => {
    await db.insert(whiteCards).values([
      { text: "in pack", pack: "Base", active: true },
      { text: "other pack", pack: "Expansion", active: true },
    ]);

    const result = await handler(mockEvent({ pack: "Base" }));

    expect(result.cards.map((c) => c.text)).toEqual(["in pack"]);
  });

  it("matches search case-insensitively against card text", async () => {
    await db.insert(whiteCards).values([
      { text: "A Wonderful Thing", active: true },
      { text: "something else", active: true },
    ]);

    const result = await handler(mockEvent({ search: "wonderful" }));

    expect(result.cards.map((c) => c.text)).toEqual(["A Wonderful Thing"]);
  });

  it("pages through results while reporting the full match count", async () => {
    await db.insert(whiteCards).values(
      ["a", "b", "c", "d", "e"].map((text) => ({ text, pack: "Base", active: true })),
    );

    const page1 = await handler(mockEvent({ pack: "Base", page: "1", perPage: "2" }));
    const page2 = await handler(mockEvent({ pack: "Base", page: "2", perPage: "2" }));

    expect(page1.total).toBe(5);
    expect(page2.total).toBe(5);
    expect(page1.cards.map((c) => c.text)).toEqual(["a", "b"]);
    expect(page2.cards.map((c) => c.text)).toEqual(["c", "d"]);
  });

  it("caps perPage so a single request cannot pull an entire pack", async () => {
    await db.insert(whiteCards).values(
      Array.from({ length: 70 }, (_, i) => ({
        text: `card ${String(i).padStart(2, "0")}`,
        active: true,
      })),
    );

    const result = await handler(mockEvent({ perPage: "500" }));

    expect(result.cards).toHaveLength(60);
    expect(result.total).toBe(70);
  });

  it("rejects a card type that is neither white nor black", async () => {
    await expect(handler(mockEvent({ type: "purple" }))).rejects.toThrow();
  });
});
