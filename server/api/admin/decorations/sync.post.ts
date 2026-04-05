import { ID, Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const body = await readBody(event);
  const registryKeys: string[] = body.registryKeys ?? [];

  if (!Array.isArray(registryKeys) || registryKeys.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "registryKeys must be a non-empty array",
    });
  }

  const hasInvalidKey = registryKeys.some(
    (k) => typeof k !== "string" || k.trim() === "" || k.length > 64,
  );
  if (hasInvalidKey) {
    throw createError({
      statusCode: 400,
      statusMessage: "Each registryKey must be a non-empty string ≤ 64 characters",
    });
  }

  const { DB, DECORATIONS } = getCollectionIds();
  const tables = getAdminTables();

  const existing = await tables.listRows({
    databaseId: DB,
    tableId: DECORATIONS,
    queries: [Query.limit(500)],
  });

  const existingIds = new Set(existing.rows.map((doc: any) => doc.decorationId));
  const registrySet = new Set(registryKeys);

  const created: string[] = [];
  for (const key of registryKeys) {
    if (existingIds.has(key)) continue;
    const name = key.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    await tables.createRow({
      databaseId: DB,
      tableId: DECORATIONS,
      rowId: ID.unique(),
      data: {
        decorationId: key,
        name,
        description: "",
        type: "unknown",
        rarity: "common",
        enabled: false,
        freeForAll: false,
        discordSkuId: null,
        price: 0,
        sortOrder: 999,
      },
    });
    created.push(key);
  }

  const orphaned = existing.rows
    .filter((doc: any) => !registrySet.has(doc.decorationId))
    .map((doc: any) => doc.decorationId);

  return {
    created,
    existing: registryKeys.filter((k) => existingIds.has(k)),
    orphaned,
  };
});
