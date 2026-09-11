import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { decorations } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";
import { normalizeLayers, type DecorationLayers } from "#shared/decorationLayers";
import { resolveLayers } from "#shared/decorationLegacy";
import { slugify, uniqueSlug } from "#shared/decorationAssets";
import { STARTERS, type StarterId } from "#shared/decorationPresets";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = ((await readBody(event)) ?? {}) as Record<string, unknown>;
  const db = useDb();

  const name =
    typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : "New decoration";
  const taken = new Set((await db.select({ id: decorations.id }).from(decorations)).map((r) => r.id));
  const requested = typeof body.slug === "string" && body.slug.trim() ? body.slug : name;
  const id = uniqueSlug(slugify(requested), taken);

  let layers: DecorationLayers = { v: 1, layers: [] };
  let source: typeof decorations.$inferSelect | undefined;
  if (typeof body.copyFrom === "string") {
    [source] = await db.select().from(decorations).where(eq(decorations.id, body.copyFrom)).limit(1);
    if (!source) throw createError({ statusCode: 404, statusMessage: "Decoration to copy not found" });
    layers = resolveLayers(source);
  } else if (body.layers !== undefined) {
    layers = normalizeLayers(body.layers);
  } else if (typeof body.starter === "string" && body.starter in STARTERS) {
    layers = STARTERS[body.starter as StarterId].build();
  }

  const [row] = await db
    .insert(decorations)
    .values({
      id,
      name,
      description: source?.description ?? "",
      type: "layered",
      rarity: source?.rarity ?? "common",
      category: source?.category ?? "custom",
      enabled: false,
      freeForAll: false,
      discordSkuId: null,
      price: "0",
      sortOrder: source?.sortOrder ?? 999,
      layers,
    })
    .returning();

  return { $id: row.id, decorationId: row.id, name: row.name };
});
