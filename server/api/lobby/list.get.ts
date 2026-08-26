import { eq, ne, desc, and } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies } from "~/server/db/schema";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const db = useDb();
  const status = (query.status as string) ?? "waiting";

  return db
    .select()
    .from(lobbies)
    .where(and(eq(lobbies.status, status as "waiting" | "playing" | "complete"), ne(lobbies.vcOnly, true)))
    .orderBy(desc(lobbies.createdAt))
    .limit(100);
});
