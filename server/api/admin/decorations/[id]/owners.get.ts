import { desc, eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { userDecorations, users } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing decoration id" });

  return useDb()
    .select({
      userId: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      acquiredAt: userDecorations.acquiredAt,
      source: userDecorations.source,
    })
    .from(userDecorations)
    .innerJoin(users, eq(users.id, userDecorations.userId))
    .where(eq(userDecorations.decorationId, id))
    .orderBy(desc(userDecorations.acquiredAt));
});
