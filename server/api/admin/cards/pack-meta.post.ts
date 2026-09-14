// Update one pack's metadata, by id or by name. Only fields present in the
// body are written, so toggling NSFW cannot blank a description the form did
// not send. `name` renames the pack in place (see renamePack); the retired
// `displayName` is ignored.

import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { cardPacks } from "~~/server/db/schema";
import { ensurePackByName, findPackId, packMetaColumns, renamePack } from "~~/server/utils/packs";
import { requireAdmin } from "~~/server/utils/session";
import { normalizePackText } from "#shared/packMetaText";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody<{
    id?: string;
    pack?: string;
    name?: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    series?: string | null;
    sortOrder?: number;
    official?: boolean;
    nsfw?: boolean;
  }>(event);

  const db = useDb();

  let id: string | null = null;
  if (body.id) {
    id = await findPackId(db, body.id);
    if (!id) throw createError({ statusCode: 404, statusMessage: "Pack not found" });
  } else if (typeof body.pack === "string" && body.pack.trim()) {
    // Not normalized: an existing name may contain double spaces, and
    // collapsing them would create a second pack instead of finding this one.
    id = await ensurePackByName(db, body.pack);
  } else {
    throw createError({ statusCode: 400, statusMessage: "pack id or name is required" });
  }

  if (typeof body.name === "string") await renamePack(db, id, body.name);

  const updates: Record<string, unknown> = {};
  for (const key of ["description", "icon", "color", "series"] as const) {
    if (key in body) updates[key] = normalizePackText(body[key]);
  }
  if (typeof body.sortOrder === "number") updates.sortOrder = body.sortOrder;
  if (typeof body.official === "boolean") updates.official = body.official;
  if (typeof body.nsfw === "boolean") updates.nsfw = body.nsfw;

  if (Object.keys(updates).length) {
    await db.update(cardPacks).set(updates).where(eq(cardPacks.id, id));
  }

  const [row] = await db.select(packMetaColumns).from(cardPacks).where(eq(cardPacks.id, id));
  return row;
});
