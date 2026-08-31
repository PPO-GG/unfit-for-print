import { inArray, ne, desc, and } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies } from "~~/server/db/schema";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const db = useDb();
  const statuses = ((query.status as string) ?? "waiting,playing")
    .split(",")
    .map((s) => s.trim()) as ("waiting" | "playing" | "complete")[];

  return db
    .select()
    .from(lobbies)
    .where(
      and(
        inArray(lobbies.status, statuses),
        ne(lobbies.vcOnly, true),
        ne(lobbies.isPrivate, true),
      ),
    )
    .orderBy(desc(lobbies.createdAt))
    .limit(100);
});
