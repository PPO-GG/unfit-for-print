import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { cardPacks } from "~~/server/db/schema";
import { ensurePackByName, findPackId } from "~~/server/utils/packs";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { pack, packId: rawId, isDefault } = await readBody<{
    pack?: string;
    packId?: string;
    isDefault: boolean;
  }>(event);
  const db = useDb();

  // By name, an unknown pack is created: marking a name default before any
  // card lands in it was allowed when defaults were a bare name list.
  const packId = rawId ? await findPackId(db, rawId) : pack ? await ensurePackByName(db, pack) : null;
  if (!packId) throw createError({ statusCode: 404, statusMessage: "Pack not found" });

  const [row] = await db
    .update(cardPacks)
    .set({ isDefault: Boolean(isDefault) })
    .where(eq(cardPacks.id, packId))
    .returning({ name: cardPacks.name });

  return { success: true, pack: row?.name ?? pack, isDefault: Boolean(isDefault) };
});
