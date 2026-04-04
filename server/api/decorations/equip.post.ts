import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody(event);
  const decorationId: string | null = body.decorationId ?? null;
  const config = useRuntimeConfig();

  // If equipping, verify user owns this decoration
  if (decorationId) {
    const tables = getAdminTables();
    const owned = await tables.listRows({
      databaseId: config.public.appwriteDatabaseId as string,
      tableId: config.public.appwriteUserDecorationsCollectionId as string,
      queries: [
        Query.equal("userId", userId),
        Query.equal("decorationId", decorationId),
      ],
    });
    if (!owned.total || owned.total === 0) {
      throw createError({ statusCode: 403, statusMessage: "Decoration not owned" });
    }
  }

  // Update user prefs via admin Users API
  const { users } = useAppwriteAdmin();
  const user = await users.get(userId);
  const currentPrefs = user.prefs || {};
  await users.updatePrefs(userId, {
    ...currentPrefs,
    activeDecoration: decorationId || "",
  });

  return { activeDecoration: decorationId };
});
