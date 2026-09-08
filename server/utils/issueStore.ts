import { eq, sql } from "drizzle-orm";
import { useDb } from "../db/client";
import { issueEvents, issueGroups } from "../db/schema";
import type { IssueKind } from "~/types/issue";
import { EVENT_CAP_PER_GROUP } from "./issueConstants";
import type { NormalizedIssue } from "./issueIngest";

export interface RecordIssueResult {
  groupId: string;
  kind: IssueKind;
  title: string;
  lobbyCode: string | null;
  appVersion: string;
  shouldNotify: boolean;
  isRegression: boolean;
}

export async function recordIssue(
  input: NormalizedIssue,
  meta: { userId: string | null },
): Promise<RecordIssueResult> {
  const db = useDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    // FOR UPDATE, not a plain read: two concurrent reports of the same
    // resolved group would otherwise both see 'resolved' before either
    // commits, both set wasResolved, and both fire a regression alert. The
    // lock serializes them so the second sees 'open' and stays quiet. On a
    // brand-new fingerprint there is no row to lock, and that path is
    // already race-safe via the eventCount === 1 test below.
    const [prior] = await tx
      .select({ status: issueGroups.status })
      .from(issueGroups)
      .where(eq(issueGroups.fingerprint, input.fingerprint))
      .limit(1)
      .for("update");

    const wasResolved = prior?.status === "resolved";
    const isMuted = prior?.status === "muted";

    const [group] = await tx
      .insert(issueGroups)
      .values({
        fingerprint: input.fingerprint,
        kind: input.kind,
        title: input.title,
        firstAppVersion: input.appVersion,
        eventCount: 1,
        firstSeen: now,
        lastSeen: now,
        notifiedAt: now,
      })
      .onConflictDoUpdate({
        target: issueGroups.fingerprint,
        set: {
          eventCount: sql`${issueGroups.eventCount} + 1`,
          lastSeen: now,
          // A resolved bug that came back is news, and reopening it is what
          // puts it back in the default admin filter. A muted one is never
          // news — its status and notifiedAt are left exactly as they are.
          ...(wasResolved ? { status: "open" as const, notifiedAt: now } : {}),
        },
      })
      .returning();

    const row = group!;
    // Exact and clock-independent: a conflicting update always returns 2+.
    const isNew = row.eventCount === 1;
    const isRegression = !isNew && wasResolved;

    if (row.eventCount <= EVENT_CAP_PER_GROUP) {
      await tx.insert(issueEvents).values({
        groupId: row.id,
        message: input.message,
        stack: input.stack,
        lobbyCode: input.lobbyCode,
        userId: meta.userId,
        appVersion: input.appVersion,
        platform: input.platform,
        route: input.route,
        context: input.context,
      });
    }

    return {
      groupId: row.id,
      kind: row.kind as IssueKind,
      title: row.title,
      lobbyCode: input.lobbyCode,
      appVersion: input.appVersion,
      shouldNotify: (isNew || isRegression) && !isMuted,
      isRegression,
    };
  });
}
