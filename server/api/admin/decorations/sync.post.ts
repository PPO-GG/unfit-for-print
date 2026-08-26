import { useDb } from "~/server/db/client";
import { decorations } from "~/server/db/schema";
import { requireAdmin } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

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

  const db = useDb();
  const existing = await db.select().from(decorations).limit(500);

  const existingIds = new Set(existing.map((row) => row.id));
  const registrySet = new Set(registryKeys);

  const created: string[] = [];
  for (const key of registryKeys) {
    if (existingIds.has(key)) continue;
    const name = key.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    await db.insert(decorations).values({
      id: key,
      name,
      description: "",
      type: "effect",
      rarity: "common",
      category: "custom",
      enabled: false,
      freeForAll: false,
      discordSkuId: null,
      price: "0",
      sortOrder: 999,
      imageKey: null,
      imageFormat: null,
    });
    created.push(key);
  }

  const orphaned = existing
    .filter((row) => !registrySet.has(row.id))
    .map((row) => row.id);

  return {
    created,
    existing: registryKeys.filter((k) => existingIds.has(k)),
    orphaned,
  };
});
