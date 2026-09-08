import { and, desc, eq, type SQL } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { issueGroups } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

const KINDS = [
  "client-error",
  "api-error",
  "player-report",
  "anomaly",
  "server-error",
] as const;
const STATUSES = ["open", "resolved", "muted"] as const;

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const query = getQuery(event);

  const filters: SQL[] = [];
  if (typeof query.kind === "string" && query.kind) {
    if (!KINDS.includes(query.kind as any)) {
      throw createError({ statusCode: 400, statusMessage: "invalid kind" });
    }
    filters.push(eq(issueGroups.kind, query.kind as (typeof KINDS)[number]));
  }
  if (typeof query.status === "string" && query.status) {
    if (!STATUSES.includes(query.status as any)) {
      throw createError({ statusCode: 400, statusMessage: "invalid status" });
    }
    filters.push(
      eq(issueGroups.status, query.status as (typeof STATUSES)[number]),
    );
  }

  // Clamped and truncated, not just capped. An unclamped negative limit makes
  // drizzle emit no LIMIT clause at all — returning the whole table — and a
  // fractional one reaches an int8 bind and 500s. Both are reachable from a
  // hand-edited URL.
  const limit = Math.min(
    Math.max(Math.trunc(Number(query.limit)) || 50, 1),
    200,
  );
  const offset = Math.max(Math.trunc(Number(query.offset)) || 0, 0);

  const groups = await useDb()
    .select()
    .from(issueGroups)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(issueGroups.lastSeen))
    .limit(limit)
    .offset(offset);

  return { groups };
});
