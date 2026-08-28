const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/webp", "image/jpeg"];

export function detectCardImageFormat(mimeType: string): "png" | "webp" | "jpeg" | null {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg") return "jpeg";
  return null;
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const formData = await readMultipartFormData(event);
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No file uploaded" });
  }

  const file = formData.find((f) => f.name === "file");
  if (!file || !file.data || !file.filename) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing 'file' field in upload",
    });
  }

  const mimeType = file.type || "";
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid file type: ${mimeType}. Allowed: ${ALLOWED_TYPES.join(", ")}`,
    });
  }

  if (file.data.length > MAX_SIZE) {
    throw createError({
      statusCode: 400,
      statusMessage: `File too large: ${(file.data.length / 1024 / 1024).toFixed(1)}MB. Maximum: 5MB`,
    });
  }

  const imageFormat = detectCardImageFormat(mimeType);
  if (!imageFormat) {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot determine format for ${mimeType} file "${file.filename}".`,
    });
  }

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const fileId = crypto.randomUUID();
  const key = `${fileId}-${file.filename}`;

  await useR2().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
      Body: file.data,
      ContentType: mimeType,
    }),
  );

  return {
    fileId: key,
    name: file.filename,
    size: file.data.length,
    mimeType,
    imageFormat,
  };
});
