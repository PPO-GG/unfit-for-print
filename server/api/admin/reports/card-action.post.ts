// server/api/admin/reports/card-action.post.ts
// Inline card actions from the report viewer: edit text, toggle active, delete card

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const body = await readBody(event);
  const { action, cardId, cardType, text, active } = body;

  if (!cardId || !cardType) {
    throw createError({
      statusCode: 400,
      message: "cardId and cardType are required",
    });
  }

  const config = useRuntimeConfig();
  const tables = getAdminTables();
  const collectionId =
    cardType === "black"
      ? config.public.appwriteBlackCardCollectionId
      : config.public.appwriteWhiteCardCollectionId;

  const dbId = config.public.appwriteDatabaseId;

  switch (action) {
    case "edit": {
      if (!text?.trim()) {
        throw createError({
          statusCode: 400,
          message: "text is required for edit",
        });
      }
      const updated = await tables.updateRow({
        databaseId: dbId,
        tableId: collectionId,
        rowId: cardId,
        data: { text: text.trim() },
      });
      return { success: true, card: updated };
    }

    case "toggle": {
      const card = await tables.getRow({
        databaseId: dbId,
        tableId: collectionId,
        rowId: cardId,
      });
      const updated = await tables.updateRow({
        databaseId: dbId,
        tableId: collectionId,
        rowId: cardId,
        data: { active: !card.active },
      });
      return { success: true, card: updated };
    }

    case "delete": {
      await tables.deleteRow({
        databaseId: dbId,
        tableId: collectionId,
        rowId: cardId,
      });
      return { success: true };
    }

    default:
      throw createError({
        statusCode: 400,
        message: `Unknown action: ${action}`,
      });
  }
});
