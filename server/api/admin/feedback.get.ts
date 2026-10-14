import { and, arrayContains, desc, eq, isNotNull, sql, type SQL } from "drizzle-orm";
import { FEEDBACK_TOPICS, type FeedbackTopic } from "#shared/feedback";
import { useDb } from "~~/server/db/client";
import { feedback, users } from "~~/server/db/schema";
import { fillWeeklyGaps } from "~~/server/utils/feedbackStats";
import { requireAdmin } from "~~/server/utils/session";

const round2 = (v: string | number | null): number | null =>
  v === null ? null : Math.round(Number(v) * 100) / 100;

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const query = getQuery(event);

  const filters: SQL[] = [];
  if (query.rating !== undefined && query.rating !== "") {
    const rating = Number(query.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw createError({ statusCode: 400, statusMessage: "invalid rating" });
    }
    filters.push(eq(feedback.rating, rating));
  }
  if (typeof query.topic === "string" && query.topic) {
    if (!FEEDBACK_TOPICS.includes(query.topic as FeedbackTopic)) {
      throw createError({ statusCode: 400, statusMessage: "invalid topic" });
    }
    filters.push(arrayContains(feedback.topics, [query.topic]));
  }
  if (query.withMessage !== "false") {
    filters.push(isNotNull(feedback.message));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  // Clamped and truncated for the same reason as /api/admin/issues: a
  // negative limit drops the LIMIT clause and a fractional one 500s.
  const pageSize = Math.min(Math.max(Math.trunc(Number(query.pageSize)) || 20, 1), 50);
  const page = Math.max(Math.trunc(Number(query.page)) || 1, 1);

  const db = useDb();
  const last30 = sql`${feedback.createdAt} >= now() - interval '30 days'`;
  const prev30 = sql`${feedback.createdAt} >= now() - interval '60 days' and ${feedback.createdAt} < now() - interval '30 days'`;

  const [[summaryRow], weeklyRows, distRows, items, [totalRow]] = await Promise.all([
    db
      .select({
        avg30: sql<string | null>`avg(${feedback.rating}) filter (where ${last30})`,
        avgPrev: sql<string | null>`avg(${feedback.rating}) filter (where ${prev30})`,
        ratings30: sql<number>`(count(${feedback.rating}) filter (where ${last30}))::int`,
        total30: sql<number>`(count(*) filter (where ${last30}))::int`,
        withMsg30: sql<number>`(count(${feedback.message}) filter (where ${last30}))::int`,
      })
      .from(feedback),
    db
      .select({
        weekStart: sql<string>`to_char(date_trunc('week', ${feedback.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
        avgRating: sql<string | null>`avg(${feedback.rating})`,
        count: sql<number>`count(*)::int`,
      })
      .from(feedback)
      .where(sql`${feedback.createdAt} >= date_trunc('week', now() at time zone 'UTC') - interval '11 weeks'`)
      .groupBy(sql`1`),
    db
      .select({ rating: feedback.rating, count: sql<number>`count(*)::int` })
      .from(feedback)
      .where(and(isNotNull(feedback.rating), sql`${feedback.createdAt} >= now() - interval '90 days'`))
      .groupBy(feedback.rating),
    db
      .select({
        id: feedback.id,
        createdAt: feedback.createdAt,
        rating: feedback.rating,
        topics: feedback.topics,
        message: feedback.message,
        source: feedback.source,
        platform: feedback.platform,
        gamesCompletedHint: feedback.gamesCompletedHint,
        lobbyCode: feedback.lobbyCode,
        userName: users.name,
        isGuest: users.isGuest,
      })
      .from(feedback)
      // Left join: guests are pruned, and their feedback must still show.
      .leftJoin(users, eq(users.id, feedback.userId))
      .where(where)
      .orderBy(desc(feedback.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(feedback).where(where),
  ]);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const d of distRows) {
    if (d.rating && d.rating >= 1 && d.rating <= 5) {
      distribution[d.rating as 1 | 2 | 3 | 4 | 5] = d.count;
    }
  }

  const total30 = summaryRow?.total30 ?? 0;
  return {
    summary: {
      avgRating30d: round2(summaryRow?.avg30 ?? null),
      avgRatingPrev30d: round2(summaryRow?.avgPrev ?? null),
      ratings30d: summaryRow?.ratings30 ?? 0,
      withMessagePct30d: total30 ? Math.round(((summaryRow?.withMsg30 ?? 0) / total30) * 100) : 0,
    },
    weekly: fillWeeklyGaps(
      weeklyRows.map((w) => ({ weekStart: w.weekStart, avgRating: round2(w.avgRating), count: w.count })),
      new Date(),
    ),
    distribution,
    items: items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })),
    total: totalRow?.total ?? 0,
  };
});
