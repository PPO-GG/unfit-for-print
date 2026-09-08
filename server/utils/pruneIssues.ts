import { and, eq, lt } from "drizzle-orm";
import { useDb } from "../db/client";
import { issueEvents, issueGroups } from "../db/schema";

const EVENT_RETENTION_DAYS = 30;
const RESOLVED_GROUP_RETENTION_DAYS = 90;

/**
 * Events are the bulk and age out at 30 days. Groups are small and carry the
 * history, so only resolved ones are ever removed — an open group is kept
 * regardless of age, because "old and still broken" is exactly the thing
 * worth keeping, and a muted group is kept so the problem can't re-alert as
 * though it were new.
 */
export async function pruneIssues(): Promise<{
  eventsDeleted: number;
  groupsDeleted: number;
}> {
  const db = useDb();
  const eventCutoff = new Date(
    Date.now() - EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const groupCutoff = new Date(
    Date.now() - RESOLVED_GROUP_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  const deletedEvents = await db
    .delete(issueEvents)
    .where(lt(issueEvents.createdAt, eventCutoff))
    .returning({ id: issueEvents.id });

  const deletedGroups = await db
    .delete(issueGroups)
    .where(
      and(
        eq(issueGroups.status, "resolved"),
        lt(issueGroups.lastSeen, groupCutoff),
      ),
    )
    .returning({ id: issueGroups.id });

  return {
    eventsDeleted: deletedEvents.length,
    groupsDeleted: deletedGroups.length,
  };
}
