// server/api/admin/lobby/prune.post.ts
// Admin-only endpoint to trigger pruning of stale/orphaned lobbies.

import { createError, readBody } from "h3";
import { pruneStaleLobbies, type PruneLobbiesOptions } from "~~/server/utils/pruneLobbies";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = (await readBody<PruneLobbiesOptions>(event).catch(() => ({}))) || {};

  try {
    const result = await pruneStaleLobbies(body);
    return result;
  } catch (err: any) {
    console.error("[admin/lobby/prune] Pruning failed:", err);
    throw createError({
      statusCode: 500,
      statusMessage: err?.message || "Failed to prune stale lobbies",
    });
  }
});
