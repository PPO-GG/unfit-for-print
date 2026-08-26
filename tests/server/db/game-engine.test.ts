import { describe, it, expect, beforeEach } from "vitest";
import { useDb } from "~/server/db/client";
import { whiteCards } from "~/server/db/schema";
import { fetchAllIds, shuffle } from "~/server/utils/game-engine";

const db = useDb();

beforeEach(async () => {
  await db.delete(whiteCards);
});

describe("fetchAllIds", () => {
  it("returns only active cards, filtered by pack when given", async () => {
    await db.insert(whiteCards).values([
      { text: "a", pack: "Base", active: true },
      { text: "b", pack: "Base", active: false },
      { text: "c", pack: "Other", active: true },
    ]);

    const ids = await fetchAllIds(whiteCards, ["Base"]);
    expect(ids).toHaveLength(1);
  });

  it("returns all active cards when no pack filter given", async () => {
    await db.insert(whiteCards).values([
      { text: "a", pack: "Base", active: true },
      { text: "b", pack: "Other", active: true },
    ]);

    const ids = await fetchAllIds(whiteCards);
    expect(ids).toHaveLength(2);
  });
});

describe("shuffle", () => {
  it("preserves all elements", () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle([...input]);
    expect(result.sort()).toEqual(input);
  });
});
