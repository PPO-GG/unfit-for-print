import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies } from "~~/server/db/schema";
import { requireHost } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { lobbyId, vcOnly } = await readBody<{ lobbyId: string; vcOnly: boolean }>(event);
  await requireHost(event, lobbyId);
  await useDb().update(lobbies).set({ vcOnly }).where(eq(lobbies.id, lobbyId));
  return { success: true };
});
