import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { submissions, whiteCards, blackCards } from "~/server/db/schema";
import { requireAdmin } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { submissionId } = await readBody<{ submissionId: string }>(event);
  const db = useDb();

  const [sub] = await db.select().from(submissions).where(eq(submissions.id, submissionId)).limit(1);
  if (!sub) throw createError({ statusCode: 404, statusMessage: "Submission not found" });

  const table = sub.cardType === "white" ? whiteCards : blackCards;
  const values: Record<string, unknown> = { text: sub.text, pack: "Unfit Labs", active: true };
  if (sub.cardType === "black") values.pick = sub.pick ?? 1;

  const [card] = await db.insert(table).values(values as any).returning();
  await db.delete(submissions).where(eq(submissions.id, submissionId));

  return { card };
});
