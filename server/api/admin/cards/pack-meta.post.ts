// Upsert one pack's metadata. Only the fields present in the body are
// written, so editing the NSFW toggle cannot blank a description the form
// did not send.

import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { cardPacks } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody<{
    pack?: string;
    displayName?: string | null;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    series?: string | null;
    sortOrder?: number;
    official?: boolean;
    nsfw?: boolean;
  }>(event);

  if (typeof body.pack !== "string" || !body.pack.trim()) {
    throw createError({ statusCode: 400, statusMessage: "pack name is required" });
  }
  const pack = body.pack.trim();

  const updates: Record<string, unknown> = {};
  for (const key of ["displayName", "description", "icon", "color", "series"] as const) {
    if (key in body) updates[key] = body[key] ?? null;
  }
  if (typeof body.sortOrder === "number") updates.sortOrder = body.sortOrder;
  if (typeof body.official === "boolean") updates.official = body.official;
  if (typeof body.nsfw === "boolean") updates.nsfw = body.nsfw;

  const db = useDb();

  // A body carrying only `pack` is a legal request — an empty metadata row
  // is a valid state — but Drizzle throws on an empty `set`, so fall back to
  // onConflictDoNothing() and read the row back instead of updating it.
  if (Object.keys(updates).length === 0) {
    await db.insert(cardPacks).values({ pack }).onConflictDoNothing();
    const [row] = await db.select().from(cardPacks).where(eq(cardPacks.pack, pack));
    return row;
  }

  const [row] = await db
    .insert(cardPacks)
    .values({ pack, ...updates })
    .onConflictDoUpdate({ target: cardPacks.pack, set: updates })
    .returning();

  return row;
});
