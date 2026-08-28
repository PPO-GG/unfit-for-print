import { DeleteObjectCommand } from "@aws-sdk/client-s3";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const key = getRouterParam(event, "key");
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: "key is required" });
  }

  await useR2().send(new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }));

  return { success: true };
});
