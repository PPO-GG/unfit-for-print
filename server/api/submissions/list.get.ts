import { desc } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { submissions } from "~/server/db/schema";

export default defineEventHandler(async (event) => {
  const limit = Number(getQuery(event).limit ?? 50);
  return useDb().select().from(submissions).orderBy(desc(submissions.createdAt)).limit(limit);
});
