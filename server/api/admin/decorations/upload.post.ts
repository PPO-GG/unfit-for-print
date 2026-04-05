import { ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import type { ImageFormat } from "~/types/decoration";

const BUCKET_ID = "decoration-images";
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = [
  "image/png",
  "image/webp",
  "application/json",
  "application/zip",
  "application/octet-stream",
];

export function detectImageFormat(
  mimeType: string,
  filename: string,
): ImageFormat | null {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "application/json") return "lottie";
  if (
    (mimeType === "application/zip" || mimeType === "application/octet-stream") &&
    filename.endsWith(".lottie")
  ) {
    return "dotlottie";
  }
  return null;
}

export function isValidLottieJson(buffer: Buffer): boolean {
  try {
    const json = JSON.parse(buffer.toString("utf-8"));
    return (
      typeof json.v === "string" &&
      typeof json.fr === "number" &&
      typeof json.w === "number" &&
      typeof json.h === "number" &&
      Array.isArray(json.layers)
    );
  } catch {
    return false;
  }
}

export function isValidDotLottie(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

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
      statusMessage: `File too large: ${(file.data.length / 1024 / 1024).toFixed(1)}MB. Maximum: 2MB`,
    });
  }

  const imageFormat = detectImageFormat(mimeType, file.filename);
  if (!imageFormat) {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot determine format for ${mimeType} file "${file.filename}". dotLottie files must have a .lottie extension.`,
    });
  }

  if (imageFormat === "lottie" && !isValidLottieJson(file.data)) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Invalid Lottie JSON — must contain v (string), fr (number), w (number), h (number), and layers (array) at the top level.",
    });
  }

  if (imageFormat === "dotlottie" && !isValidDotLottie(file.data)) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Invalid dotLottie file — file does not appear to be a valid ZIP archive.",
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
    imageFormat,
  };
});
