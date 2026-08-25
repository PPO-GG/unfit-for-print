import { GetObjectCommand } from "@aws-sdk/client-s3";

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key");
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: "key is required" });
  }

  const object = await useR2().send(
    new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }),
  );

  if (object.ContentType) {
    setResponseHeader(event, "content-type", object.ContentType);
  }

  return sendStream(event, object.Body as any);
});
