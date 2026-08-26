import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, reports, whiteCards, blackCards, lobbies, players } from "~/server/db/schema";

const db = useDb();
let currentUserId: string;

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return {
    ...actual,
    requireAuth: async () => currentUserId,
    requireAdmin: async () => currentUserId,
  };
});

function mockEvent(body?: unknown) {
  globalThis.readBody = async () => body;
  return {} as any;
}

beforeEach(async () => {
  await db.delete(reports);
  await db.delete(whiteCards);
  await db.delete(blackCards);
  // Also clear lobbies: leftover rows from other suites can reference users
  // via a NOT NULL FK, which would otherwise block deleting users below.
  await db.delete(lobbies);
  await db.delete(players);
  await db.delete(users);
  const [user] = await db.insert(users).values({ name: "Reporter" }).returning();
  currentUserId = user.id;
});

afterEach(async () => {
  // Guard against leaking a report/user into other test files that share
  // this database (run with --no-file-parallelism).
  await db.delete(reports);
  await db.delete(users);
});

describe("reports", () => {
  it("creates a report attributed to the caller", async () => {
    const [card] = await db.insert(whiteCards).values({ text: "Bad card" }).returning();
    const handler = (await import("~/server/api/reports/create.post")).default;
    const result = await handler(
      mockEvent({ cardId: card.id, cardType: "white", reason: "Offensive" }),
    );
    expect(result.reportedBy).toBe(currentUserId);
  });

  it("index enriches with card text, correcting cardType if found in the other table", async () => {
    const [card] = await db
      .insert(blackCards)
      .values({ text: "Actually black?", pack: "Base" })
      .returning();
    await db.insert(reports).values({
      cardId: card.id,
      cardType: "white", // deliberately wrong, mirrors the historical bug
      reason: "test",
      reportedBy: currentUserId,
    });

    const handler = (await import("~/server/api/admin/reports/index")).default;
    const result = await handler({} as any);
    expect(result.reports[0].cardText).toBe("Actually black?");
    expect(result.reports[0].cardType).toBe("black");
    expect(result.reports[0].cardPack).toBe("Base");
  });

  it("index returns cardPack null when the card is not found in either table", async () => {
    await db.insert(reports).values({
      cardId: "00000000-0000-0000-0000-000000000000",
      cardType: "white",
      reason: "test",
      reportedBy: currentUserId,
    });

    const handler = (await import("~/server/api/admin/reports/index")).default;
    const result = await handler({} as any);
    expect(result.reports[0].cardText).toBeNull();
    expect(result.reports[0].cardPack).toBeNull();
  });

  it("card-action edits card text via cardTable helper", async () => {
    const [card] = await db.insert(whiteCards).values({ text: "old" }).returning();
    const handler = (await import("~/server/api/admin/reports/card-action.post")).default;
    const result = await handler(
      mockEvent({ action: "edit", cardId: card.id, cardType: "white", text: "new" }),
    );
    expect(result.card.text).toBe("new");

    const [row] = await db.select().from(whiteCards).where(eq(whiteCards.id, card.id));
    expect(row.text).toBe("new");
  });

  it("card-action toggles card active flag", async () => {
    const [card] = await db.insert(blackCards).values({ text: "x?", active: true }).returning();
    const handler = (await import("~/server/api/admin/reports/card-action.post")).default;
    const result = await handler(
      mockEvent({ action: "toggle", cardId: card.id, cardType: "black" }),
    );
    expect(result.card.active).toBe(false);
  });

  it("card-action deletes a card", async () => {
    const [card] = await db.insert(whiteCards).values({ text: "gone" }).returning();
    const handler = (await import("~/server/api/admin/reports/card-action.post")).default;
    await handler(mockEvent({ action: "delete", cardId: card.id, cardType: "white" }));

    const rows = await db.select().from(whiteCards).where(eq(whiteCards.id, card.id));
    expect(rows).toHaveLength(0);
  });

  it("dismiss deletes a report", async () => {
    const [card] = await db.insert(whiteCards).values({ text: "x" }).returning();
    const [report] = await db
      .insert(reports)
      .values({ cardId: card.id, cardType: "white", reason: "x", reportedBy: currentUserId })
      .returning();

    const handler = (await import("~/server/api/admin/reports/dismiss.post")).default;
    await handler(mockEvent({ reportId: report.id }));

    const rows = await db.select().from(reports).where(eq(reports.id, report.id));
    expect(rows).toHaveLength(0);
  });
});
