import { and, eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { userDecorations } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { userId, decorationId } = body;

  if (!userId || !decorationId) {
    throw createError({ statusCode: 400, statusMessage: "userId and decorationId are required" });
  }

  const db = useDb();

  const [existing] = await db
    .select()
    .from(userDecorations)
    .where(and(eq(userDecorations.userId, userId), eq(userDecorations.decorationId, decorationId)))
    .limit(1);

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: "User already owns this decoration" });
  }

  await db.insert(userDecorations).values({
    userId,
    decorationId,
    source: "admin_grant",
  });

  return { success: true };
});
