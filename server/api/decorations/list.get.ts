import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { userDecorations } from "~~/server/db/schema";
import { requireAuth } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const rows = await useDb().select().from(userDecorations).where(eq(userDecorations.userId, userId));
  return rows.map((r) => ({ decorationId: r.decorationId, acquiredAt: r.acquiredAt, source: r.source }));
});
