import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { users } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { userId } = await readBody<{ userId: string }>(event);
  await useDb().delete(users).where(eq(users.id, userId));
  return { success: true };
});
