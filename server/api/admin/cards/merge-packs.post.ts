// Merge packs into one. Every source's cards move to the target and the source
// rows are deleted; the target keeps its name, metadata and default flag.
// A lobby that had a source pack selected stops drawing from it — its id no
// longer exists — which the admin UI states before the merge runs.

import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { cardPacks } from "~~/server/db/schema";
import { isPackId, mergePacks, packMetaColumns } from "~~/server/utils/packs";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { sourceIds, targetId } = await readBody<{ sourceIds?: unknown; targetId?: unknown }>(event);

  if (!isPackId(targetId)) {
    throw createError({ statusCode: 400, statusMessage: "targetId must be a pack id" });
  }
  if (!Array.isArray(sourceIds) || !sourceIds.length || !sourceIds.every(isPackId)) {
    throw createError({ statusCode: 400, statusMessage: "sourceIds must be a non-empty array of pack ids" });
  }

  return useDb().transaction(async (tx) => {
    const moved = await mergePacks(tx, sourceIds, targetId);
    const [target] = await tx.select(packMetaColumns).from(cardPacks).where(eq(cardPacks.id, targetId));
    return { moved, target };
  });
});
