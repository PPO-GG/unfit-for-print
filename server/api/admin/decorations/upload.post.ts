import { ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

const BUCKET_ID = "decoration-images";
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/png", "image/webp"];

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

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

  // Validate MIME type
  const mimeType = file.type || "";
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid file type: ${mimeType}. Allowed: ${ALLOWED_TYPES.join(", ")}`,
    });
  }

  // Validate size
  if (file.data.length > MAX_SIZE) {
    throw createError({
      statusCode: 400,
      statusMessage: `File too large: ${(file.data.length / 1024 / 1024).toFixed(1)}MB. Maximum: 2MB`,
    });
  }

  const { storage } = useAppwriteAdmin();
  const fileId = ID.unique();

  const uploaded = await storage.createFile(
    BUCKET_ID,
    fileId,
    InputFile.fromBuffer(file.data, file.filename),
  );

  return {
    fileId: uploaded.$id,
    name: uploaded.name,
    size: uploaded.sizeOriginal,
    mimeType: uploaded.mimeType,
  };
});
