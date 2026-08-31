import { desc, eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { users } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  return useDb()
    .select()
    .from(users)
    .where(eq(users.isGuest, false))
    .orderBy(desc(users.createdAt));
});


