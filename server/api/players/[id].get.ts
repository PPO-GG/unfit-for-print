import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { players } from "~/server/db/schema";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const [player] = await useDb().select().from(players).where(eq(players.id, id!)).limit(1);
  return player ?? null;
});
