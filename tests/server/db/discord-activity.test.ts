// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users } from "~/server/db/schema";
import { verifyActivityToken } from "~/server/utils/activityToken";

const db = useDb();

beforeEach(async () => {
  await db.delete(users);
  process.env.NUXT_ACTIVITY_TOKEN_SECRET = "test-secret-at-least-32-chars-long";
});

describe("discord-activity find-or-create + token issuance", () => {
  it("issues a token whose payload resolves to the created user's id", async () => {
    const [created] = await db
      .insert(users)
      .values({ discordUserId: "activity-user-1", name: "ActivityUser", isGuest: false })
      .returning();

    const { signActivityToken } = await import("~/server/utils/activityToken");
    const token = signActivityToken(created.id);
    const payload = verifyActivityToken(token);

    expect(payload?.userId).toBe(created.id);

    const [found] = await db.select().from(users).where(eq(users.id, payload!.userId));
    expect(found.discordUserId).toBe("activity-user-1");
  });
});
