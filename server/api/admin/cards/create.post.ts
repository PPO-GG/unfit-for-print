import { useDb } from "~~/server/db/client";
import { assertCardHasContent, cardTable } from "~~/server/utils/cardTable";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { type, text, pack, pick, imageFileId, imageFormat, attachment } = await readBody<{
    type: string;
    text?: string | null;
    pack?: string;
    pick?: number;
    imageFileId?: string | null;
    imageFormat?: string | null;
    attachment?: Record<string, unknown> | null;
  }>(event);

  assertCardHasContent(text, imageFileId);

  const table = cardTable(type);
  const db = useDb();

  const values: Record<string, unknown> = {
    text: imageFileId ? null : text,
    pack,
    active: true,
    imageKey: imageFileId || null,
    imageFormat: imageFileId ? imageFormat || null : null,
    attachment: imageFileId ? attachment || null : null,
  };
  if (type === "black") values.pick = pick ?? 1;

  const [created] = await db.insert(table).values(values as any).returning();
  return created;
});
