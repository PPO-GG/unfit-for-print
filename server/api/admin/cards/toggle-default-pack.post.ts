import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { defaultCardPacks } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { pack, isDefault } = await readBody<{ pack: string; isDefault: boolean }>(event);
  const db = useDb();

  if (isDefault) {
    await db.insert(defaultCardPacks).values({ pack }).onConflictDoNothing();
  } else {
    await db.delete(defaultCardPacks).where(eq(defaultCardPacks.pack, pack));
  }

  return { success: true, pack, isDefault };
});
