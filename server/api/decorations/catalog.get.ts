import { eq, asc } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { decorations } from "~~/server/db/schema";
import { toCatalogEntry } from "~~/server/utils/decorationRows";

export default defineEventHandler(async () => {
  const rows = await useDb()
    .select()
    .from(decorations)
    .where(eq(decorations.enabled, true))
    .orderBy(asc(decorations.sortOrder))
    .limit(100);
  return rows.map(toCatalogEntry);
});
