import { inArray, ne, desc, and } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies } from "~~/server/db/schema";
import { reconcileLobbiesForBrowser } from "~~/server/utils/reconcileLobbies";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const db = useDb();
  const statuses = ((query.status as string) ?? "waiting,playing")
    .split(",")
    .map((s) => s.trim()) as ("waiting" | "playing" | "complete")[];

  // Correct rows that drifted from the live Y.Docs first, so the filters below
  // run on current data. Fails open if Teleportal is unreachable. Throttled,
  // since every visitor to the lobby browser lands here.
  await reconcileLobbiesForBrowser();

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
