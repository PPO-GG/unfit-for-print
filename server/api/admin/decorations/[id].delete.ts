import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { decorations } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const docId = getRouterParam(event, "id");
  if (!docId) {
    throw createError({ statusCode: 400, statusMessage: "Missing decoration document ID" });
  }

  await useDb().delete(decorations).where(eq(decorations.id, docId));

  return { success: true };
});
