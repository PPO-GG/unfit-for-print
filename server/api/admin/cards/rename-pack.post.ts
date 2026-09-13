// Rename a pack in place. Its id does not change, so a lobby that selected
// it, and any admin URL pointing at it, keep working — the whole reason packs
// have ids. Onto a name another pack already has, this refuses (409) rather
// than merging: merging is merge-packs.post.ts, and the admin has to choose it.

import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { cardPacks } from "~~/server/db/schema";
import { isPackId, packMetaColumns, renamePack } from "~~/server/utils/packs";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { id, name } = await readBody<{ id?: string; name?: string }>(event);

  if (!isPackId(id)) {
    throw createError({ statusCode: 400, statusMessage: "id must be a pack id" });
  }

  const db = useDb();
  await renamePack(db, id, name ?? "");
  const [row] = await db.select(packMetaColumns).from(cardPacks).where(eq(cardPacks.id, id));
  return row;
});
