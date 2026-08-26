import { DeleteObjectCommand } from "@aws-sdk/client-s3";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const fileId = getRouterParam(event, "fileId");
  if (!fileId) {
    throw createError({ statusCode: 400, statusMessage: "fileId is required" });
  }

  await useR2().send(
    new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: fileId }),
  );

  return { success: true };
});
