// server/api/admin/reports/dismiss.post.ts
import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { reports } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { reportId } = body;

  if (!reportId) {
    throw createError({ statusCode: 400, message: "reportId is required" });
  }

  await useDb().delete(reports).where(eq(reports.id, reportId));

  return { success: true };
});
