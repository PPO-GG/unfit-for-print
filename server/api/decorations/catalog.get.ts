import { eq, asc } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { decorations } from "~/server/db/schema";

export default defineEventHandler(async () => {
  return useDb()
    .select()
    .from(decorations)
    .where(eq(decorations.enabled, true))
    .orderBy(asc(decorations.sortOrder))
    .limit(100);
});
