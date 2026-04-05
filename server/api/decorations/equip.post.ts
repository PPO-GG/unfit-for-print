import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody(event);
  const decorationId: string | null = body.decorationId ?? null;

  // If equipping, verify user owns this decoration or it's free for all
  if (decorationId) {
    const { DB, DECORATIONS, USER_DECORATIONS } = getCollectionIds();
    const tables = getAdminTables();

    // Check if decoration is free for all
    const catalogResult = await tables.listRows({
      databaseId: DB,
      tableId: DECORATIONS,
      queries: [
        Query.equal("decorationId", decorationId),
        Query.equal("enabled", true),
        Query.limit(1),
      ],
    });

    const isFreeForAll =
      catalogResult.total > 0 && catalogResult.rows[0]?.freeForAll === true;

    if (!isFreeForAll) {
      // Must own it
      const owned = await tables.listRows({
        databaseId: DB,
        tableId: USER_DECORATIONS,
        queries: [
          Query.equal("userId", userId),
          Query.equal("decorationId", decorationId),
          Query.limit(1),
        ],
      });
      if (!owned.total || owned.total === 0) {
        throw createError({ statusCode: 403, statusMessage: "Decoration not owned" });
      }
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
