const BUCKET_ID = "decoration-images";

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const fileId = getRouterParam(event, "fileId");
  if (!fileId) {
    throw createError({ statusCode: 400, statusMessage: "Missing file ID" });
  }

  const { storage } = useAppwriteAdmin();
  await storage.deleteFile(BUCKET_ID, fileId);

  return { success: true };
});
