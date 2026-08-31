import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies } from "~~/server/db/schema";
import { requireHost } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { lobbyId, vcOnly, isPrivate } = await readBody<{
    lobbyId: string;
    vcOnly?: boolean;
    isPrivate?: boolean;
  }>(event);
  await requireHost(event, lobbyId);

  const updates: { vcOnly?: boolean; isPrivate?: boolean } = {};
  if (vcOnly !== undefined) updates.vcOnly = vcOnly;
  if (isPrivate !== undefined) updates.isPrivate = isPrivate;

  await useDb().update(lobbies).set(updates).where(eq(lobbies.id, lobbyId));
  return { success: true };
});
