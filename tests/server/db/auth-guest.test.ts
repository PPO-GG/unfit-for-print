// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";
import { useDb } from "~/server/db/client";
import { users } from "~/server/db/schema";

const db = useDb();

beforeEach(async () => {
  await db.delete(users);
});

describe("guest user creation", () => {
  it("creates a guest user row with isGuest true and no discordUserId", async () => {
    const [guest] = await db
      .insert(users)
      .values({ name: "Guest123", isGuest: true })
      .returning();

    expect(guest.isGuest).toBe(true);
    expect(guest.discordUserId).toBeNull();
    expect(guest.name).toBe("Guest123");
  });
});
