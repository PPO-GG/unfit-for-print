// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import {
  blackCards,
  decorations,
  lobbies,
  players,
  reports,
  submissions,
  userDecorations,
  users,
  whiteCards,
} from "~/server/db/schema";

const db = useDb();

beforeEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE
      "users",
      "lobbies",
      "players",
      "white_cards",
      "black_cards",
      "submissions",
      "reports",
      "decorations",
      "user_decorations"
    RESTART IDENTITY CASCADE
  `);
});

describe("schema", () => {
  it("inserts a user and reads it back", async () => {
    const [created] = await db
      .insert(users)
      .values({ name: "Test User", isGuest: true })
      .returning();
    const [found] = await db
      .select()
      .from(users)
      .where(eq(users.id, created.id));

    expect(found.name).toBe("Test User");
    expect(found.isGuest).toBe(true);
    expect(found.isAdmin).toBe(false);
  });

  it("cascades player deletion when a lobby is deleted", async () => {
    const [host] = await db.insert(users).values({ name: "Host" }).returning();
    const [lobby] = await db
      .insert(lobbies)
      .values({ code: "ABCD", hostUserId: host.id })
      .returning();
    await db.insert(players).values({
      userId: host.id,
      lobbyId: lobby.id,
      name: "Host",
      isHost: true,
    });

    await db.delete(lobbies).where(eq(lobbies.id, lobby.id));

    const remaining = await db
      .select()
      .from(players)
      .where(eq(players.lobbyId, lobby.id));
    expect(remaining).toHaveLength(0);
  });

  it("creates rows in every persistent table", async () => {
    const [user] = await db
      .insert(users)
      .values({ name: "Isolation User" })
      .returning();
    const [lobby] = await db
      .insert(lobbies)
      .values({ code: "ISOL", hostUserId: user.id })
      .returning();

    await db.insert(players).values({
      userId: user.id,
      lobbyId: lobby.id,
      name: "Isolation User",
    });
    await db.insert(whiteCards).values({ text: "Isolation white card" });
    await db.insert(blackCards).values({ text: "Isolation black card" });
    await db.insert(submissions).values({
      submitterId: user.id,
      submitterName: "Isolation User",
      cardType: "white",
      text: "Isolation submission",
    });
    await db.insert(reports).values({
      cardId: user.id,
      cardType: "white",
      reason: "Isolation report",
      reportedBy: user.id,
    });
    await db.insert(decorations).values({
      id: "isolation-decoration",
      name: "Isolation decoration",
      description: "Verifies database cleanup",
      type: "avatar",
      rarity: "common",
    });
    await db.insert(userDecorations).values({
      userId: user.id,
      decorationId: "isolation-decoration",
      source: "test",
    });
  });

  it("starts each test with every persistent table empty", async () => {
    const rows = await Promise.all([
      users,
      lobbies,
      players,
      whiteCards,
      blackCards,
      submissions,
      reports,
      decorations,
      userDecorations,
    ].map((table) => db.select().from(table)));

    expect(rows).toEqual([[], [], [], [], [], [], [], [], []]);
  });
});
