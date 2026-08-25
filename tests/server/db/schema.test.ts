// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, players, users } from "~/server/db/schema";

const db = useDb();

beforeEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
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
});
