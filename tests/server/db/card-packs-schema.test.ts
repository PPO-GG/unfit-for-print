import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { cardPacks } from "~/server/db/schema";

const db = useDb();

beforeEach(async () => {
  await db.delete(cardPacks);
});

describe("card_packs table", () => {
  it("stores metadata keyed by the pack name, with sane defaults", async () => {
    await db.insert(cardPacks).values({ pack: "Base" });

    const [row] = await db.select().from(cardPacks).where(eq(cardPacks.pack, "Base"));

    expect(row.pack).toBe("Base");
    expect(row.displayName).toBeNull();
    expect(row.description).toBeNull();
    expect(row.icon).toBeNull();
    expect(row.color).toBeNull();
    expect(row.sortOrder).toBe(0);
    expect(row.official).toBe(false);
    expect(row.nsfw).toBe(false);
  });

  it("round-trips every metadata field", async () => {
    await db.insert(cardPacks).values({
      pack: "Blue Box",
      displayName: "Blue Box Expansion",
      description: "The blue one.",
      icon: "🟦",
      color: "#3b82f6",
      sortOrder: 5,
      official: true,
      nsfw: true,
    });

    const [row] = await db.select().from(cardPacks).where(eq(cardPacks.pack, "Blue Box"));

    expect(row.displayName).toBe("Blue Box Expansion");
    expect(row.description).toBe("The blue one.");
    expect(row.icon).toBe("🟦");
    expect(row.color).toBe("#3b82f6");
    expect(row.sortOrder).toBe(5);
    expect(row.official).toBe(true);
    expect(row.nsfw).toBe(true);
  });

  it("rejects a duplicate pack key", async () => {
    await db.insert(cardPacks).values({ pack: "Base" });
    await expect(db.insert(cardPacks).values({ pack: "Base" })).rejects.toThrow();
  });
});
