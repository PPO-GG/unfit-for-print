import { GetObjectCommand } from "@aws-sdk/client-s3";
import { isSafeAssetKey } from "#shared/decorationAssets";

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key");
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: "key is required" });
  }

  if (!isSafeAssetKey(key)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid key" });
  }

  let object;
  try {
    object = await useR2().send(
      new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }),
    );
  } catch (err: any) {
    if (
      err?.name === "NoSuchKey" ||
      err?.Code === "NoSuchKey" ||
      err?.$metadata?.httpStatusCode === 404
    ) {
      throw createError({ statusCode: 404, statusMessage: "Not found" });
    }
    throw err;
  }

  if (object.ContentType) {
    setResponseHeader(event, "content-type", object.ContentType);
  }
  // SVG decorations are admin-uploaded. Inside <img> they can't script, and
  // this makes opening the URL directly just as inert.
  setResponseHeader(
    event,
    "content-security-policy",
    "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  );
  setResponseHeader(event, "x-content-type-options", "nosniff");
  // Decoration image keys are content-addressed (uuid-prefixed) and never
  // reused, so they're safe to cache immutably.
  setResponseHeader(
    event,
    "cache-control",
    "public, max-age=31536000, immutable",
  );

  return sendStream(event, object.Body as any);
});
