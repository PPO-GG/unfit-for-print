import { asc } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { decorations } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";
import { toCatalogEntry } from "~~/server/utils/decorationRows";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const rows = await useDb()
    .select()
    .from(decorations)
    .orderBy(asc(decorations.sortOrder))
    .limit(500);
  return rows.map(toCatalogEntry);
});
