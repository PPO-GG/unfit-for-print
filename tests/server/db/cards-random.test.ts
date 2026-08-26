import { describe, it, expect, beforeEach } from "vitest";
import { useDb } from "~/server/db/client";
import { whiteCards, blackCards } from "~/server/db/schema";

const db = useDb();

function mockEvent(query: Record<string, string>) {
  globalThis.getQuery = () => query;
  return {} as any;
}

beforeEach(async () => {
  await db.delete(whiteCards);
  await db.delete(blackCards);
});

describe("GET /api/cards/random", () => {
  it("returns null when no active cards match", async () => {
    const handler = (await import("~/server/api/cards/random.get")).default;
    const result = await handler(mockEvent({ type: "white" }));
    expect(result).toBeNull();
  });

  it("returns a random active white card", async () => {
    await db.insert(whiteCards).values([
      { text: "A", active: true },
      { text: "B", active: true },
      { text: "C", active: false },
    ]);
    const handler = (await import("~/server/api/cards/random.get")).default;
    const result = await handler(mockEvent({ type: "white" }));
    expect(["A", "B"]).toContain(result.text);
  });

  it("filters black cards by pick count", async () => {
    await db.insert(blackCards).values([
      { text: "Pick 1?", active: true, pick: 1 },
      { text: "Pick 2?", active: true, pick: 2 },
    ]);
    const handler = (await import("~/server/api/cards/random.get")).default;
    const result = await handler(mockEvent({ type: "black", pick: "2" }));
    expect(result.text).toBe("Pick 2?");
  });
});
