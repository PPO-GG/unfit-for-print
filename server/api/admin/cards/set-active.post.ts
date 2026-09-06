import { inArray } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { cardTable } from "~~/server/utils/cardTable";
import { requireAdmin } from "~~/server/utils/session";

/**
 * Set `active` to an explicit value on a batch of cards.
 *
 * Deliberately not `toggle.post.ts`: the duplicate scanner needs to say
 * "disable these" and mean it. A toggle would re-enable a card an admin had
 * already disabled if the same cluster came up twice, which is exactly the
 * bug that makes a resolved duplicate reappear in play.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { ids, type, active } = await readBody<{
    ids: string[];
    type: string;
    active: boolean;
  }>(event);

  if (!Array.isArray(ids) || ids.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "ids must be a non-empty array",
    });
  }

  if (typeof active !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: "active must be a boolean",
    });
  }

  const table = cardTable(type);
  const updated = await useDb()
    .update(table)
    .set({ active })
    .where(inArray(table.id, ids))
    .returning({ id: table.id });

  return { updated: updated.length, ids: updated.map((row) => row.id) };
});
