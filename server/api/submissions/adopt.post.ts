import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { submissions, whiteCards, blackCards } from "~~/server/db/schema";
import { validateCardText } from "~~/server/utils/cardText";
import { ensurePackByName } from "~~/server/utils/packs";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { submissionId } = await readBody<{ submissionId: string }>(event);
  const db = useDb();

  const [sub] = await db.select().from(submissions).where(eq(submissions.id, submissionId)).limit(1);
  if (!sub) throw createError({ statusCode: 404, statusMessage: "Submission not found" });

  // Rows submitted before card text was validated on the way in can still
  // carry markup, and adopting one promotes it to a card every player sees.
  const validated = validateCardText(sub.text);
  if (!validated.ok) {
    throw createError({ statusCode: 400, statusMessage: validated.reason });
  }

  const table = sub.cardType === "white" ? whiteCards : blackCards;
  const packId = await ensurePackByName(db, "Unfit Labs");
  const values: Record<string, unknown> = { text: validated.text, packId, active: true };
  if (sub.cardType === "black") values.pick = sub.pick ?? 1;

  const [card] = await db.insert(table).values(values as any).returning();
  await db.delete(submissions).where(eq(submissions.id, submissionId));

  return { card: { ...card, pack: "Unfit Labs" } };
});
