import { desc, eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { issueEvents, issueGroups } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "id is required" });
  }

  const db = useDb();
  const [group] = await db
    .select()
    .from(issueGroups)
    .where(eq(issueGroups.id, id))
    .limit(1);

  if (!group) {
    throw createError({ statusCode: 404, statusMessage: "Issue not found" });
  }

  // Most recent occurrences only. A group can hold up to 500 rows and the
  // page never needs all of them at once.
  const events = await db
    .select()
    .from(issueEvents)
    .where(eq(issueEvents.groupId, id))
    .orderBy(desc(issueEvents.createdAt))
    .limit(50);

  return { group, events };
});
