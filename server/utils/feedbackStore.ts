import { eq, sql } from "drizzle-orm";
import { useDb } from "../db/client";
import { feedback } from "../db/schema";
import type { NormalizedFeedback } from "./feedbackIngest";

export type FeedbackRow = typeof feedback.$inferSelect;

export interface UpsertFeedbackResult {
  row: FeedbackRow;
  /** True exactly once per row: the write that first gave it a message. The
   *  row's notifiedAt is already set when this is true. */
  messageIsNew: boolean;
}

/**
 * Inserts, or enriches the row with the same clientRef. Enrich means: a
 * non-null rating or message overwrites, a null never clears; a non-empty
 * topic list replaces; first-write metadata is kept; a missing user id is
 * filled in.
 */
export async function upsertFeedback(
  input: NormalizedFeedback,
  meta: { userId: string | null },
): Promise<UpsertFeedbackResult> {
  const db = useDb();

  return db.transaction(async (tx) => {
    // FOR UPDATE so two near-simultaneous follow-ups cannot both see "no
    // message yet" and both claim the ping.
    const [prior] = await tx
      .select({ message: feedback.message })
      .from(feedback)
      .where(eq(feedback.clientRef, input.clientRef))
      .limit(1)
      .for("update");

    const [row] = await tx
      .insert(feedback)
      .values({
        clientRef: input.clientRef,
        rating: input.rating,
        topics: input.topics,
        message: input.message,
        source: input.source,
        userId: meta.userId,
        lobbyCode: input.lobbyCode,
        gamesCompletedHint: input.gamesCompletedHint,
        platform: input.platform,
        appVersion: input.appVersion,
      })
      .onConflictDoUpdate({
        target: feedback.clientRef,
        set: {
          rating: sql`coalesce(excluded.rating, ${feedback.rating})`,
          topics: sql`case when cardinality(excluded.topics) > 0 then excluded.topics else ${feedback.topics} end`,
          message: sql`coalesce(excluded.message, ${feedback.message})`,
          userId: sql`coalesce(${feedback.userId}, excluded.user_id)`,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    const messageIsNew =
      row!.message !== null && !prior?.message && row!.notifiedAt === null;
    if (!messageIsNew) return { row: row!, messageIsNew: false };

    const [claimed] = await tx
      .update(feedback)
      .set({ notifiedAt: new Date() })
      .where(eq(feedback.id, row!.id))
      .returning();
    return { row: claimed!, messageIsNew: true };
  });
}
