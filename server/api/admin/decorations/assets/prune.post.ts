import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { requireAdmin } from "~~/server/utils/session";
import { useR2, getR2Bucket } from "~~/server/utils/r2";
import { allReferencedAssetKeys } from "~~/server/utils/decorationRows";
import { DECO_KEY_PREFIX } from "#shared/decorationAssets";

/** Uploads younger than this may belong to a studio session still open. */
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes studio uploads nothing references. Scoped to the `deco-` prefix on
 * purpose: legacy root-level keys and anything the card tables store in the
 * same bucket are never even listed.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const referenced = await allReferencedAssetKeys();
  const cutoff = Date.now() - MIN_AGE_MS;
  const bucket = getR2Bucket();

  let token: string | undefined;
  let scanned = 0;
  let deleted = 0;
  do {
    const page = await useR2().send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: DECO_KEY_PREFIX, ContinuationToken: token }),
    );
    for (const obj of page.Contents ?? []) {
      scanned++;
      if (!obj.Key || referenced.has(obj.Key)) continue;
      if (!obj.LastModified || obj.LastModified.getTime() > cutoff) continue;
      try {
        await useR2().send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
        deleted++;
      } catch (err) {
        console.error("[decorations] prune failed to delete", obj.Key, err);
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  return { scanned, deleted };
});
