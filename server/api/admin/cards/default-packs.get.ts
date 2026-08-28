import { useDb } from "~~/server/db/client";
import { defaultCardPacks } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = useDb();
  const rows = await db.select().from(defaultCardPacks);
  return { packs: rows.map((r) => r.pack) };
});
