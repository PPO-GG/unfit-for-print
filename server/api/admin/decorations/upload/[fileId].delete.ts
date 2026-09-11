import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { DECO_KEY_PREFIX, isSafeAssetKey } from "#shared/decorationAssets";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const fileId = getRouterParam(event, "fileId");
  if (!fileId) {
    throw createError({ statusCode: 400, statusMessage: "fileId is required" });
  }

  if (!fileId.startsWith(DECO_KEY_PREFIX) || !isSafeAssetKey(fileId)) {
    throw createError({ statusCode: 400, statusMessage: "Only studio uploads can be discarded here" });
  }

  await useR2().send(
    new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: fileId }),
  );

  return { success: true };
});
