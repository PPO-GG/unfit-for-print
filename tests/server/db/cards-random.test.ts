import { describe, it, expect, beforeEach } from "vitest";
import handler from "~/server/api/cards/random.get";
import { resetCardTables, insertCards, seedPack } from "./helpers/cards";
import { whiteCards, blackCards } from "~/server/db/schema";

function mockEvent(query: Record<string, string>) {
  globalThis.getQuery = () => query;
  return {} as any;
}

beforeEach(async () => {
  await resetCardTables();
});

describe("GET /api/cards/random", () => {
  it("returns null when no active cards match", async () => {
    const result = await handler(mockEvent({ type: "white" }));
    expect(result).toBeNull();
  });

  it("returns a random active white card", async () => {
    await insertCards(whiteCards, [
      { text: "A", active: true },
      { text: "B", active: true },
      { text: "C", active: false },
    ]);
    const result = await handler(mockEvent({ type: "white" }));
    expect(["A", "B"]).toContain(result.text);
  });

  it("filters black cards by pick count", async () => {
    await insertCards(blackCards, [
      { text: "Pick 1?", active: true, pick: 1 },
      { text: "Pick 2?", active: true, pick: 2 },
    ]);
    const result = await handler(mockEvent({ type: "black", pick: "2" }));
    expect(result.text).toBe("Pick 2?");
  });

  it("labels the card with its pack's current name", async () => {
    await insertCards(whiteCards, { text: "only", pack: "Base", active: true });
    const id = await seedPack("Base");

    const card = await handler(mockEvent({ type: "white", pack: id }));

    expect(card).toMatchObject({ text: "only", pack: "Base", packId: id });
  });
});
