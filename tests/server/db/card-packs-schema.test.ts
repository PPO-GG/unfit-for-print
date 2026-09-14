import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { cardPacks, whiteCards } from "~/server/db/schema";
import { resetCardTables } from "./helpers/cards";

const db = useDb();

beforeEach(resetCardTables);

describe("card_packs registry", () => {
  it("gives each pack a generated id and sane defaults", async () => {
    const [row] = await db.insert(cardPacks).values({ name: "Base" }).returning();

    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.name).toBe("Base");
    expect(row.description).toBeNull();
    expect(row.series).toBeNull();
    expect(row.sortOrder).toBe(0);
    expect(row.official).toBe(false);
    expect(row.nsfw).toBe(false);
    expect(row.isDefault).toBe(false);
  });

  it("round-trips every metadata field", async () => {
    const [{ id }] = await db
      .insert(cardPacks)
      .values({
        name: "Blue Box",
        description: "The blue one.",
        icon: "🟦",
        color: "#3b82f6",
        sortOrder: 5,
        official: true,
        nsfw: true,
        isDefault: true,
        series: "Cards Against Humanity",
      })
      .returning({ id: cardPacks.id });

    const [row] = await db.select().from(cardPacks).where(eq(cardPacks.id, id));

    expect(row).toMatchObject({
      name: "Blue Box",
      description: "The blue one.",
      icon: "🟦",
      color: "#3b82f6",
      sortOrder: 5,
      official: true,
      nsfw: true,
      isDefault: true,
      series: "Cards Against Humanity",
    });
  });

  it("rejects a duplicate name", async () => {
    await db.insert(cardPacks).values({ name: "Base" });
    await expect(db.insert(cardPacks).values({ name: "Base" })).rejects.toThrow();
  });

  it("refuses a card pointing at a pack that does not exist", async () => {
    await expect(
      db.insert(whiteCards).values({ text: "orphan", packId: randomUUID() }),
    ).rejects.toThrow();
  });
});
