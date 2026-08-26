// server/api/admin/reports/card-action.post.ts
// Inline card actions from the report viewer: edit text, toggle active, delete card

import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { cardTable } from "~/server/utils/cardTable";
import { requireAdmin } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { action, cardId, cardType, text } = body;

  if (!cardId || !cardType) {
    throw createError({
      statusCode: 400,
      message: "cardId and cardType are required",
    });
  }

  const table = cardTable(cardType);
  const db = useDb();

  switch (action) {
    case "edit": {
      if (!text?.trim()) {
        throw createError({
          statusCode: 400,
          message: "text is required for edit",
        });
      }
      const [updated] = await db
        .update(table)
        .set({ text: text.trim() })
        .where(eq(table.id, cardId))
        .returning();
      return { success: true, card: updated };
    }

    case "toggle": {
      const [card] = await db.select().from(table).where(eq(table.id, cardId)).limit(1);
      if (!card) throw createError({ statusCode: 404, statusMessage: "Card not found" });

      const [updated] = await db
        .update(table)
        .set({ active: !card.active })
        .where(eq(table.id, cardId))
        .returning();
      return { success: true, card: updated };
    }

    case "delete": {
      await db.delete(table).where(eq(table.id, cardId));
      return { success: true };
    }

    default:
      throw createError({
        statusCode: 400,
        message: `Unknown action: ${action}`,
      });
  }
});
