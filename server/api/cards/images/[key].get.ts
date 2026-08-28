import { GetObjectCommand } from "@aws-sdk/client-s3";

// Card image keys are `${uuid}-${originalFilename}` and the original
// filename isn't sanitized on upload, so it may contain spaces, unicode,
// parentheses, etc. Only reject control characters, path traversal
// sequences, and a leading slash.
const UNSAFE_KEY_PATTERN = /[\x00-\x1f\x7f]/;

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key");
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: "key is required" });
  }

  if (UNSAFE_KEY_PATTERN.test(key) || key.includes("..") || key.startsWith("/")) {
    throw createError({ statusCode: 400, statusMessage: "Invalid key" });
  }

  let object;
  try {
    object = await useR2().send(new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }));
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
  // Card image keys are content-addressed (uuid-prefixed) and never reused.
  setResponseHeader(event, "cache-control", "public, max-age=31536000, immutable");

  return sendStream(event, object.Body as any);
});
