import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { submissions, users } from "~/server/db/schema";
import { requireAuth } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const { cardType, text, pick } = await readBody<{
    cardType: "white" | "black";
    text: string;
    pick?: number;
  }>(event);

  if (cardType !== "white" && cardType !== "black") {
    throw createError({ statusCode: 400, statusMessage: "cardType must be 'white' or 'black'" });
  }
  if (!text || !text.trim()) {
    throw createError({ statusCode: 400, statusMessage: "text is required" });
  }

  const db = useDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  const [created] = await db
    .insert(submissions)
    .values({
      submitterId: userId,
      submitterName: user?.name ?? "Anonymous",
      cardType,
      text,
      pick: cardType === "black" ? pick : undefined,
    })
    .returning();

  return created;
});
