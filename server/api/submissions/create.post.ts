import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { submissions, users } from "~~/server/db/schema";
import { validateCardText } from "~~/server/utils/cardText";
import { requireAuth } from "~~/server/utils/session";

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
  const validated = validateCardText(text);
  if (!validated.ok) {
    throw createError({ statusCode: 400, statusMessage: validated.reason });
  }

  const db = useDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  const [created] = await db
    .insert(submissions)
    .values({
      submitterId: userId,
      submitterName: user?.name ?? "Anonymous",
      cardType,
      text: validated.text,
      pick: cardType === "black" ? pick : undefined,
    })
    .returning();

  return created;
});
