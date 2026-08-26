import { GetObjectCommand } from "@aws-sdk/client-s3";

// Decoration image keys are `${uuid}-${originalFilename}` (see
// server/api/admin/decorations/upload.post.ts) and the original filename is
// not sanitized on upload, so it may contain spaces, unicode, parentheses,
// etc. We only reject control characters, path traversal sequences, and a
// leading slash — not a strict allowlist that would break legitimate
// legacy/unicode filenames.
const UNSAFE_KEY_PATTERN = /[\x00-\x1f\x7f]/;

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key");
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: "key is required" });
  }

  if (
    UNSAFE_KEY_PATTERN.test(key) ||
    key.includes("..") ||
    key.startsWith("/")
  ) {
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
  // Decoration image keys are content-addressed (uuid-prefixed) and never
  // reused, so they're safe to cache immutably.
  setResponseHeader(
    event,
    "cache-control",
    "public, max-age=31536000, immutable",
  );

  return sendStream(event, object.Body as any);
});
