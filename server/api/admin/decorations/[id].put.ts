import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { decorations } from "~/server/db/schema";
import { requireAdmin } from "~/server/utils/session";

// "attachment" is intentionally omitted: the Drizzle `decorations` schema
// (Task 1) has no column for it, so attachment-positioning config from the
// admin editor is accepted by the client but not persisted server-side.
const ALLOWED_FIELDS = [
  "name",
  "description",
  "type",
  "rarity",
  "category",
  "enabled",
  "freeForAll",
  "discordSkuId",
  "price",
  "sortOrder",
  "imageFileId",
  "imageFormat",
] as const;

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const docId = getRouterParam(event, "id");
  if (!docId) {
    throw createError({ statusCode: 400, statusMessage: "Missing decoration document ID" });
  }

  const body = await readBody(event);

  const data: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] === undefined) continue;
    if (field === "imageFileId") data.imageKey = body[field];
    else if (field === "price") data.price = String(body[field]);
    else data[field] = body[field];
  }

  if (Object.keys(data).length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No valid fields to update" });
  }

  await useDb().update(decorations).set(data).where(eq(decorations.id, docId));

  return { success: true };
});
