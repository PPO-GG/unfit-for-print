import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { submissions } from "~~/server/db/schema";
import { requireAuth } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const { submissionId } = await readBody<{ submissionId: string }>(event);
  const db = useDb();

  const [sub] = await db.select().from(submissions).where(eq(submissions.id, submissionId)).limit(1);
  if (!sub) throw createError({ statusCode: 404, statusMessage: "Submission not found" });

  const hasVoted = sub.upvoterIds.includes(userId);
  const upvoterIds = hasVoted
    ? sub.upvoterIds.filter((id) => id !== userId)
    : [...sub.upvoterIds, userId];

  const [updated] = await db
    .update(submissions)
    .set({ upvotes: upvoterIds.length, upvoterIds })
    .where(eq(submissions.id, submissionId))
    .returning();
  return updated;
});
