import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { users } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const actingUserId = await requireAdmin(event);
  const { userId, isAdmin } = await readBody<{ userId: string; isAdmin: boolean }>(event);

  if (userId === actingUserId && !isAdmin) {
    throw createError({
      statusCode: 400,
      statusMessage: "You cannot remove your own admin access",
    });
  }

  await useDb().update(users).set({ isAdmin }).where(eq(users.id, userId));
  return { success: true };
});
