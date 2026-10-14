// Open issue groups per lobby code, for the admin monitor's "needs
// attention" list and lobby drawer.
import { and, count, eq, gte, inArray } from "drizzle-orm";
import type { useDb } from "../db/client";
import { issueEvents, issueGroups } from "../db/schema";

type Db = ReturnType<typeof useDb>;

export const ISSUE_WINDOW_MS = 30 * 60_000;

export interface LobbyIssue {
  groupId: string;
  title: string;
  kind: string;
  /** Events for this lobby inside the window, not the group's total. */
  eventCount: number;
}

/**
 * Never throws: the monitor must still show lobbies when issue tracking is
 * down, so a failure reads as "no issues".
 */
export async function openIssuesByLobby(
  db: Db,
  codes: string[],
  now: Date = new Date(),
): Promise<Record<string, LobbyIssue[]>> {
  if (codes.length === 0) return {};
  try {
    const rows = await db
      .select({
        code: issueEvents.lobbyCode,
        groupId: issueGroups.id,
        title: issueGroups.title,
        kind: issueGroups.kind,
        n: count(),
      })
      .from(issueEvents)
      .innerJoin(issueGroups, eq(issueEvents.groupId, issueGroups.id))
      .where(
        and(
          inArray(issueEvents.lobbyCode, codes),
          gte(issueEvents.createdAt, new Date(now.getTime() - ISSUE_WINDOW_MS)),
          eq(issueGroups.status, "open"),
        ),
      )
      .groupBy(issueEvents.lobbyCode, issueGroups.id, issueGroups.title, issueGroups.kind);

    const byCode: Record<string, LobbyIssue[]> = {};
    for (const row of rows) {
      if (!row.code) continue;
      (byCode[row.code] ??= []).push({
        groupId: row.groupId,
        title: row.title,
        kind: row.kind,
        eventCount: Number(row.n),
      });
    }
    return byCode;
  } catch (err: any) {
    console.warn("[lobbyIssues] Lookup failed:", err?.message || err);
    return {};
  }
}
