// server/api/admin/cards/set-pick.post.ts
// Bulk pick fix for the pick-mismatch scan. Black cards only — white cards have no pick.

import { inArray } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { blackCards } from "~~/server/db/schema";
import { assertValidPick } from "~~/server/utils/cardTable";
import { requireAdmin } from "~~/server/utils/session";

/** The scan page chunks "Fix all" below this, so the cap only stops runaway callers. */
const MAX_IDS = 1000;

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { ids, pick } = await readBody<{ ids?: unknown; pick?: unknown }>(event);

  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_IDS ||
    !ids.every((id) => typeof id === "string")
  ) {
    throw createError({ statusCode: 400, statusMessage: `ids must be 1 to ${MAX_IDS} card ids` });
  }
  assertValidPick(pick);

  const updated = await useDb()
    .update(blackCards)
    .set({ pick })
    .where(inArray(blackCards.id, ids))
    .returning({ id: blackCards.id });

  return { updated: updated.length };
});
