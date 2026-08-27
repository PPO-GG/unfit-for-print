import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies } from "~~/server/db/schema";

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, "code");
  const [lobby] = await useDb().select().from(lobbies).where(eq(lobbies.code, code!)).limit(1);
  return lobby ?? null;
});
