import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { players } from "~/server/db/schema";

export default defineEventHandler(async (event) => {
  const lobbyId = getQuery(event).lobbyId as string;
  return useDb().select().from(players).where(eq(players.lobbyId, lobbyId));
});
