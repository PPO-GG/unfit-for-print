import { and, desc, eq, type SQL } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { issueGroups } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const query = getQuery(event);

  const filters: SQL[] = [];
  if (typeof query.kind === "string" && query.kind) {
    filters.push(eq(issueGroups.kind, query.kind as any));
  }
  if (typeof query.status === "string" && query.status) {
    filters.push(eq(issueGroups.status, query.status as any));
  }

  const limit = Math.min(Number(query.limit ?? 50) || 50, 200);
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0);

  const groups = await useDb()
    .select()
    .from(issueGroups)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(issueGroups.lastSeen))
    .limit(limit)
    .offset(offset);

  return { groups };
});
