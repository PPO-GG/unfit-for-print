import { useDb } from "~~/server/db/client";
import { assertCardHasContent, cardTable } from "~~/server/utils/cardTable";
import { ensurePackByName, findPackId, packNameFor } from "~~/server/utils/packs";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { type, text, pack, packId, pick, imageFileId, imageFormat, attachment } = await readBody<{
    type: string;
    text?: string | null;
    /** A pack name; created if it does not exist yet. */
    pack?: string;
    packId?: string;
    pick?: number;
    imageFileId?: string | null;
    imageFormat?: string | null;
    attachment?: Record<string, unknown> | null;
  }>(event);

  assertCardHasContent(text, imageFileId);

  const table = cardTable(type);
  const db = useDb();

  let resolvedPackId: string | null = null;
  if (packId) {
    resolvedPackId = await findPackId(db, packId);
    if (!resolvedPackId) throw createError({ statusCode: 404, statusMessage: "Pack not found" });
  } else if (pack?.trim()) {
    resolvedPackId = await ensurePackByName(db, pack);
  }

  const values: Record<string, unknown> = {
    text: imageFileId ? null : text,
    packId: resolvedPackId,
    active: true,
    imageKey: imageFileId || null,
    imageFormat: imageFileId ? imageFormat || null : null,
    attachment: imageFileId ? attachment || null : null,
  };
  if (type === "black") values.pick = pick ?? 1;

  const [created] = await db.insert(table).values(values as any).returning();
  // An insert that didn't throw always returns exactly one row; `noUncheckedIndexedAccess`
  // just can't see that through the destructure.
  return { ...created!, pack: await packNameFor(db, created!.packId) };
});
