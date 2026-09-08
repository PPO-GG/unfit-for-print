import { and, eq, lt, or } from "drizzle-orm";
import { useDb } from "../db/client";
import { issueEvents, issueGroups } from "../db/schema";

const EVENT_RETENTION_DAYS = 30;
const RESOLVED_GROUP_RETENTION_DAYS = 90;

/**
 * A group whose only event has aged out of the 30-day event window and which
 * has never recurred is evidence-free — deleting it costs nothing an admin
 * could still look at. This bound exists for the adversarial case, not the
 * ordinary one: an attacker controls fingerprints completely. `player-report`
 * mints a fresh random fingerprint per event by design, and `anomaly`
 * fingerprints on an attacker-supplied `ruleId`, so every accepted
 * unauthenticated request can otherwise mint a permanent row on a database
 * with no backups. `muted` is excluded on purpose — see below.
 */
const SINGLE_EVENT_GROUP_RETENTION_DAYS = EVENT_RETENTION_DAYS;

/**
 * Events are the bulk and age out at 30 days. Groups are small and carry the
 * history, so removal is otherwise conservative: an open group with real
 * recurrence is kept regardless of age, because "old and still broken" is
 * exactly the thing worth keeping, and a muted group is kept unconditionally
 * so the problem can't re-alert as though it were new. Only two group rules
 * remove anything: a long-resolved group, and an open single-occurrence
 * group whose one event has already been pruned (see above).
 */
export async function pruneIssues(): Promise<{
  eventsDeleted: number;
  groupsDeleted: number;
}> {
  const db = useDb();
  const eventCutoff = new Date(
    Date.now() - EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const resolvedGroupCutoff = new Date(
    Date.now() - RESOLVED_GROUP_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const singleEventGroupCutoff = new Date(
    Date.now() - SINGLE_EVENT_GROUP_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  const deletedEvents = await db
    .delete(issueEvents)
    .where(lt(issueEvents.createdAt, eventCutoff))
    .returning({ id: issueEvents.id });

  const deletedGroups = await db
    .delete(issueGroups)
    .where(
      or(
        and(
          eq(issueGroups.status, "resolved"),
          lt(issueGroups.lastSeen, resolvedGroupCutoff),
        ),
        and(
          eq(issueGroups.status, "open"),
          eq(issueGroups.eventCount, 1),
          lt(issueGroups.lastSeen, singleEventGroupCutoff),
        ),
      ),
    )
    .returning({ id: issueGroups.id });

  return {
    eventsDeleted: deletedEvents.length,
    groupsDeleted: deletedGroups.length,
  };
}
