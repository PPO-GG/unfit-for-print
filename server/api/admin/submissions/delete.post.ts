import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { submissions } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { submissionId } = await readBody<{ submissionId: string }>(event);
  await useDb().delete(submissions).where(eq(submissions.id, submissionId));
  return { success: true };
});
