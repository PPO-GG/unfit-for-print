import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { players } from "~/server/db/schema";
import { requireAuth } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const { playerId, avatarUrl } = await readBody<{ playerId: string; avatarUrl: string | null }>(event);
  await useDb().update(players).set({ avatar: avatarUrl }).where(eq(players.id, playerId));
  return { success: true };
});
