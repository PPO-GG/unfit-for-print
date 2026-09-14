import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { cardPacks } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

// Names, not ids: the admin Packs screen still keys packs by name until the
// Card Explorer replaces it. /api/cards/default-packs is the id-based one.
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const rows = await useDb()
    .select({ name: cardPacks.name })
    .from(cardPacks)
    .where(eq(cardPacks.isDefault, true));
  return { packs: rows.map((r) => r.name) };
});
