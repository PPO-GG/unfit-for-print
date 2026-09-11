import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { decorations, userDecorations, users } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";
import { deleteUnreferencedAssets } from "~~/server/utils/decorationRows";
import { resolveLayers } from "#shared/decorationLegacy";
import { collectAssetKeys } from "#shared/decorationAssets";

/**
 * user_decorations cascades on delete, so deleting an owned decoration
 * silently revokes every purchase of it. Refuse unless the admin has
 * explicitly confirmed (?force=1); the studio steers them to Hide instead.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing decoration id" });
  const force = getQuery(event).force === "1";

  const db = useDb();
  const [row] = await db.select().from(decorations).where(eq(decorations.id, id)).limit(1);
  if (!row) throw createError({ statusCode: 404, statusMessage: "Decoration not found" });

  const owners = await db
    .select({ userId: userDecorations.userId })
    .from(userDecorations)
    .where(eq(userDecorations.decorationId, id));
  if (owners.length > 0 && !force) {
    throw createError({
      statusCode: 409,
      statusMessage: `${owners.length} player(s) own this decoration. Hide it instead, or force the delete.`,
    });
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ activeDecoration: null }).where(eq(users.activeDecoration, id));
    await tx.delete(decorations).where(eq(decorations.id, id));
  });

  const deletedAssets = await deleteUnreferencedAssets(
    [...collectAssetKeys(resolveLayers(row), row.imageKey)],
    id,
  );
  return { success: true, deletedAssets };
});
