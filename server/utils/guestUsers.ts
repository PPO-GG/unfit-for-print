// server/utils/guestUsers.ts
// Deletes ephemeral guest accounts that nothing references any more.
//
// Lobbies (as host), players, submissions and reports all point at users.id
// without ON DELETE CASCADE, so deleting a guest that any of them still names
// fails the whole statement — and, inside a transaction, everything before it.
// /api/lobby/leave used to hit exactly that when a guest host left: it deleted
// the account while the lobby still named them as host, so the request errored
// and the lobby was never removed. Checking the references in the same
// statement makes the delete skip such accounts instead of failing.

import { and, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import { lobbies, players, reports, submissions, users } from "~~/server/db/schema";

// The pool or a transaction — same `tx: any` idiom as server/utils/packs.ts.
type Db = any;

/**
 * Deletes those of `userIds` that are guests (no Discord account) and are not
 * referenced by any lobby, player, submission or report. Accounts that are
 * still referenced are left alone; the lobby sweeper retries them later.
 *
 * @returns the ids actually deleted.
 */
export async function deleteUnreferencedGuests(
  db: Db,
  userIds: string[],
): Promise<string[]> {
  if (userIds.length === 0) return [];

  const referencedBy = (table: any, column: any) =>
    notExists(db.select({ one: sql`1` }).from(table).where(eq(column, users.id)));

  const deleted: Array<{ id: string }> = await db
    .delete(users)
    .where(
      and(
        inArray(users.id, userIds),
        eq(users.isGuest, true),
        isNull(users.discordUserId),
        referencedBy(lobbies, lobbies.hostUserId),
        referencedBy(players, players.userId),
        referencedBy(submissions, submissions.submitterId),
        referencedBy(reports, reports.reportedBy),
      ),
    )
    .returning({ id: users.id });

  return deleted.map((row) => row.id);
}
