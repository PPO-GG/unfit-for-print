import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { decorations } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";
import { deleteUnreferencedAssets } from "~~/server/utils/decorationRows";
import { normalizeLayers } from "#shared/decorationLayers";
import { resolveLayers } from "#shared/decorationLegacy";
import { collectAssetKeys, removedAssetKeys } from "#shared/decorationAssets";

const LISTING_FIELDS = [
  "name", "description", "rarity", "category", "enabled",
  "freeForAll", "discordSkuId", "price", "sortOrder",
] as const;

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing decoration id" });

  const body = ((await readBody(event)) ?? {}) as Record<string, unknown>;
  const db = useDb();
  const [before] = await db.select().from(decorations).where(eq(decorations.id, id)).limit(1);
  if (!before) throw createError({ statusCode: 404, statusMessage: "Decoration not found" });

  const data: Record<string, unknown> = {};
  for (const field of LISTING_FIELDS) {
    if (body[field] === undefined) continue;
    data[field] = field === "price" ? String(body[field]) : body[field];
  }

  // The "before" set includes the legacy imageKey, so replacing a pre-studio
  // image deletes the old file instead of leaking it. The legacy column
  // itself is left as-is (additive-only rule); `layers` wins on read.
  let removed: string[] = [];
  if (body.layers !== undefined) {
    const layers = normalizeLayers(body.layers);
    data.layers = layers;
    removed = removedAssetKeys(
      collectAssetKeys(resolveLayers(before), before.imageKey),
      collectAssetKeys(layers),
    );
  }

  if (Object.keys(data).length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No valid fields to update" });
  }

  await db.update(decorations).set(data).where(eq(decorations.id, id));
  // Only after the write succeeds; a failed save must never cost a file.
  const deletedAssets = await deleteUnreferencedAssets(removed, id);

  return {
    success: true,
    layers: (data.layers as ReturnType<typeof normalizeLayers>) ?? resolveLayers(before),
    deletedAssets,
  };
});
