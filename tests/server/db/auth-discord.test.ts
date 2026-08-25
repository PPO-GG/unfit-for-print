// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users } from "~/server/db/schema";

const db = useDb();

beforeEach(async () => {
  await db.delete(users);
});

describe("Discord OAuth callback — user upsert logic", () => {
  it("creates a new user on first login", async () => {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.discordUserId, "discord-123"));
    expect(existing).toBeUndefined();

    const [created] = await db
      .insert(users)
      .values({
        discordUserId: "discord-123",
        name: "someuser",
        avatarUrl: "https://cdn.discordapp.com/avatars/discord-123/abc.png",
        isGuest: false,
      })
      .returning();

    expect(created.discordUserId).toBe("discord-123");
    expect(created.isGuest).toBe(false);
  });

  it("reuses the existing row and updates name/avatar on repeat login", async () => {
    const [first] = await db
      .insert(users)
      .values({ discordUserId: "discord-456", name: "oldname", isGuest: false })
      .returning();

    const [updated] = await db
      .update(users)
      .set({ name: "newname", avatarUrl: "https://example.com/new.png" })
      .where(eq(users.discordUserId, "discord-456"))
      .returning();

    expect(updated.id).toBe(first.id);
    expect(updated.name).toBe("newname");
  });
});
