import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { issueGroups } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

const STATUSES = ["open", "resolved", "muted"] as const;

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { id, status } = await readBody<{ id?: string; status?: string }>(event);

  if (!id || !status || !STATUSES.includes(status as any)) {
    throw createError({
      statusCode: 400,
      statusMessage: "id and a valid status are required",
    });
  }

  const [group] = await useDb()
    .update(issueGroups)
    .set({ status: status as (typeof STATUSES)[number] })
    .where(eq(issueGroups.id, id))
    .returning();

  if (!group) {
    throw createError({ statusCode: 404, statusMessage: "Issue not found" });
  }

  return { group };
});
