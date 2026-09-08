import { beforeEach, describe, expect, it } from "vitest";
import { useDb } from "~/server/db/client";
import { issueEvents, issueGroups } from "~/server/db/schema";
import { pruneIssues } from "~/server/utils/pruneIssues";

const db = useDb();

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

beforeEach(async () => {
  await db.delete(issueEvents);
  await db.delete(issueGroups);
});

describe("pruneIssues", () => {
  it("deletes events older than 30 days and keeps newer ones", async () => {
    const [group] = await db
      .insert(issueGroups)
      .values({ fingerprint: "a".repeat(64), kind: "client-error", title: "x" })
      .returning();

    await db.insert(issueEvents).values([
      { groupId: group!.id, message: "old", appVersion: "1.0.0", createdAt: daysAgo(31) },
      { groupId: group!.id, message: "recent", appVersion: "1.0.0", createdAt: daysAgo(2) },
    ]);

    const result = await pruneIssues();
    expect(result.eventsDeleted).toBe(1);

    const remaining = await db.select().from(issueEvents);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.message).toBe("recent");
  });

  it("deletes resolved groups untouched for 90 days", async () => {
    await db.insert(issueGroups).values({
      fingerprint: "b".repeat(64),
      kind: "client-error",
      title: "stale resolved",
      status: "resolved",
      lastSeen: daysAgo(91),
    });

    const result = await pruneIssues();
    expect(result.groupsDeleted).toBe(1);
    expect(await db.select().from(issueGroups)).toHaveLength(0);
  });

  it("keeps an open group no matter how old", async () => {
    await db.insert(issueGroups).values({
      fingerprint: "c".repeat(64),
      kind: "client-error",
      title: "old but open",
      status: "open",
      lastSeen: daysAgo(400),
    });

    await pruneIssues();
    expect(await db.select().from(issueGroups)).toHaveLength(1);
  });

  it("keeps a resolved group that recurred recently", async () => {
    await db.insert(issueGroups).values({
      fingerprint: "d".repeat(64),
      kind: "client-error",
      title: "recently resolved",
      status: "resolved",
      lastSeen: daysAgo(5),
    });

    await pruneIssues();
    expect(await db.select().from(issueGroups)).toHaveLength(1);
  });

  it("keeps a muted group no matter how old", async () => {
    // Deleting a muted group would let its problem come back as a brand-new
    // group and alert again — the exact outcome muting exists to prevent.
    await db.insert(issueGroups).values({
      fingerprint: "e".repeat(64),
      kind: "client-error",
      title: "old but muted",
      status: "muted",
      lastSeen: daysAgo(400),
    });

    await pruneIssues();
    expect(await db.select().from(issueGroups)).toHaveLength(1);
  });

  it("deletes an evidence-free single-occurrence open group", async () => {
    await db.insert(issueGroups).values({
      fingerprint: "f".repeat(64),
      kind: "player-report",
      title: "one-off, evidence long gone",
      status: "open",
      eventCount: 1,
      lastSeen: daysAgo(31),
    });

    await pruneIssues();
    expect(await db.select().from(issueGroups)).toHaveLength(0);
  });

  it("keeps an old single-occurrence group that is muted", async () => {
    await db.insert(issueGroups).values({
      fingerprint: "0".repeat(64),
      kind: "player-report",
      title: "muted one-off",
      status: "muted",
      eventCount: 1,
      lastSeen: daysAgo(31),
    });

    await pruneIssues();
    expect(await db.select().from(issueGroups)).toHaveLength(1);
  });

  it("keeps an old group that recurred more than once", async () => {
    await db.insert(issueGroups).values({
      fingerprint: "1".repeat(64),
      kind: "client-error",
      title: "recurring and still open",
      status: "open",
      eventCount: 12,
      lastSeen: daysAgo(400),
    });

    await pruneIssues();
    expect(await db.select().from(issueGroups)).toHaveLength(1);
  });
});
