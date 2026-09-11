import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { ne } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { decorations } from "~~/server/db/schema";
import { useR2, getR2Bucket } from "~~/server/utils/r2";
import { resolveLayers } from "#shared/decorationLegacy";
import { collectAssetKeys } from "#shared/decorationAssets";
import type { DecorationCatalogEntry, DecorationType, AttachmentConfig } from "~/types/decoration";
import type { AssetFormat } from "#shared/decorationLayers";

type DecorationRow = typeof decorations.$inferSelect;

/**
 * The wire shape for every decoration response. Legacy fields stay for one
 * release so a tab open across the deploy still renders; `layers` is always
 * the resolved stack, so new clients never see the legacy format.
 *
 * `type`/`image_format` are free-form `text` columns and `attachment` is an
 * untyped `jsonb` blob — the DB doesn't enforce the narrower literal unions
 * the wire contract promises. This function is the boundary that asserts
 * that contract, so the casts below are deliberate, not a shortcut:
 * `normalizeLayers`/`resolveLayers` already validate the layer data itself,
 * and the legacy fields are passed through as-is for one release.
 */
export function toCatalogEntry(row: DecorationRow): DecorationCatalogEntry {
  return {
    $id: row.id,
    decorationId: row.id,
    name: row.name,
    description: row.description,
    type: row.type as DecorationType,
    rarity: row.rarity,
    category: row.category || "custom",
    enabled: row.enabled,
    freeForAll: row.freeForAll,
    discordSkuId: row.discordSkuId || null,
    price: Number(row.price),
    sortOrder: row.sortOrder,
    imageFileId: row.imageKey || null,
    imageFormat: (row.imageFormat as AssetFormat | null) || null,
    attachment: (row.attachment as AttachmentConfig | null) ?? null,
    layers: resolveLayers(row),
  };
}

/** Every asset key any decoration references, optionally skipping one row. */
export async function allReferencedAssetKeys(excludeId?: string): Promise<Set<string>> {
  const db = useDb();
  const rows = excludeId
    ? await db.select().from(decorations).where(ne(decorations.id, excludeId))
    : await db.select().from(decorations);
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of collectAssetKeys(resolveLayers(row), row.imageKey)) keys.add(key);
  }
  return keys;
}

/**
 * Deletes the candidate keys that no *other* decoration still references
 * (a copied decoration shares its source's files). Never throws: a failed
 * R2 delete leaves an orphan for prune to find, not a failed save.
 */
export async function deleteUnreferencedAssets(candidates: string[], ownerId: string): Promise<string[]> {
  if (candidates.length === 0) return [];
  const stillUsed = await allReferencedAssetKeys(ownerId);
  const deleted: string[] = [];
  for (const key of candidates) {
    if (stillUsed.has(key)) continue;
    try {
      await useR2().send(new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }));
      deleted.push(key);
    } catch (err) {
      console.error("[decorations] failed to delete asset", key, err);
    }
  }
  return deleted;
}
