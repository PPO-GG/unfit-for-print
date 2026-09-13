import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { assertCardHasContent, cardTable } from "~~/server/utils/cardTable";
import { packNameFor } from "~~/server/utils/packs";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { id, type, text, pick, imageFileId, imageFormat, attachment } = await readBody<{
    id: string;
    type: string;
    text?: string | null;
    pick?: number;
    imageFileId?: string | null;
    imageFormat?: string | null;
    attachment?: Record<string, unknown> | null;
  }>(event);

  assertCardHasContent(text, imageFileId);

  const table = cardTable(type);
  const db = useDb();

  const updates: Record<string, unknown> = {
    text: imageFileId ? null : text,
    imageKey: imageFileId || null,
    imageFormat: imageFileId ? imageFormat || null : null,
    attachment: imageFileId ? attachment || null : null,
  };
  if (type === "black" && typeof pick === "number") updates.pick = pick;

  const [updated] = await db.update(table).set(updates).where(eq(table.id, id)).returning();
  // The client merges this row over its copy, so `pack` must be the live name,
  // not the retired column's stale value.
  return updated ? { ...updated, pack: await packNameFor(db, updated.packId) } : updated;
});
