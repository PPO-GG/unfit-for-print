import { eq, and } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { decorations, userDecorations, users } from "~/server/db/schema";
import { requireAuth } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const { decorationId } = await readBody<{ decorationId: string | null }>(event);
  const db = useDb();

  if (decorationId) {
    const [deco] = await db
      .select()
      .from(decorations)
      .where(and(eq(decorations.id, decorationId), eq(decorations.enabled, true)))
      .limit(1);

    if (!deco?.freeForAll) {
      const [owned] = await db
        .select()
        .from(userDecorations)
        .where(and(eq(userDecorations.userId, userId), eq(userDecorations.decorationId, decorationId)))
        .limit(1);
      if (!owned) throw createError({ statusCode: 403, statusMessage: "Decoration not owned" });
    }
  }

  await db.update(users).set({ activeDecoration: decorationId }).where(eq(users.id, userId));
  return { activeDecoration: decorationId };
});
