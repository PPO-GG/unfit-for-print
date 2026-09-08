import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { issueEvents, issueGroups } from "~/server/db/schema";
import { recordIssue } from "~/server/utils/issueStore";
import type { NormalizedIssue } from "~/server/utils/issueIngest";

const db = useDb();

beforeEach(async () => {
  await db.delete(issueEvents);
  await db.delete(issueGroups);
});

function issue(overrides: Partial<NormalizedIssue> = {}): NormalizedIssue {
  return {
    kind: "client-error",
    message: "boom",
    title: "boom",
    stack: null,
    lobbyCode: "AB2C",
    route: "/game/AB2C",
    platform: "web",
    appVersion: "3.19.0",
    context: { phase: "judging" },
    fingerprint: "f".repeat(64),
    ...overrides,
  };
}

describe("recordIssue", () => {
  it("creates a group on first sighting and asks to notify", async () => {
    const result = await recordIssue(issue(), { userId: null });

    expect(result.shouldNotify).toBe(true);
    expect(result.isRegression).toBe(false);

    const [group] = await db.select().from(issueGroups);
    expect(group!.eventCount).toBe(1);
    expect(group!.status).toBe("open");
    expect(group!.firstAppVersion).toBe("3.19.0");
    expect(group!.notifiedAt).not.toBeNull();
  });

  it("increments the existing group and does not re-notify", async () => {
    await recordIssue(issue(), { userId: null });
    const second = await recordIssue(issue(), { userId: null });

    expect(second.shouldNotify).toBe(false);

    const [group] = await db.select().from(issueGroups);
    expect(group!.eventCount).toBe(2);

    const events = await db.select().from(issueEvents);
    expect(events).toHaveLength(2);
  });

  it("does not overwrite firstAppVersion on later events", async () => {
    await recordIssue(issue(), { userId: null });
    await recordIssue(issue({ appVersion: "3.20.0" }), { userId: null });

    const [group] = await db.select().from(issueGroups);
    expect(group!.firstAppVersion).toBe("3.19.0");
  });

  it("reopens a resolved group and notifies once", async () => {
    await recordIssue(issue(), { userId: null });
    await db
      .update(issueGroups)
      .set({ status: "resolved" })
      .where(eq(issueGroups.fingerprint, "f".repeat(64)));

    const regression = await recordIssue(issue(), { userId: null });
    expect(regression.shouldNotify).toBe(true);
    expect(regression.isRegression).toBe(true);

    const [group] = await db.select().from(issueGroups);
    expect(group!.status).toBe("open");

    const quiet = await recordIssue(issue(), { userId: null });
    expect(quiet.shouldNotify).toBe(false);
  });

  it("notifies once when two reports race on the same resolved group", async () => {
    await recordIssue(issue(), { userId: null });
    await db
      .update(issueGroups)
      .set({ status: "resolved" })
      .where(eq(issueGroups.fingerprint, "f".repeat(64)));

    // Both start before either commits — without the FOR UPDATE read, both
    // see 'resolved' and both claim the regression.
    const [a, b] = await Promise.all([
      recordIssue(issue(), { userId: null }),
      recordIssue(issue(), { userId: null }),
    ]);

    expect([a.shouldNotify, b.shouldNotify].filter(Boolean)).toHaveLength(1);
    expect([a.isRegression, b.isRegression].filter(Boolean)).toHaveLength(1);
  });

  it("never notifies for a muted group and leaves it muted", async () => {
    await recordIssue(issue(), { userId: null });
    await db
      .update(issueGroups)
      .set({ status: "muted" })
      .where(eq(issueGroups.fingerprint, "f".repeat(64)));

    const result = await recordIssue(issue(), { userId: null });
    expect(result.shouldNotify).toBe(false);

    const [group] = await db.select().from(issueGroups);
    expect(group!.status).toBe("muted");
  });

  it("inserts rows up to exactly the cap and stops after it", async () => {
    // Pre-set the counter to just below the cap rather than inserting 498
    // rows, so the test stays fast while still crossing the boundary
    // through recordIssue itself — the earlier version jumped straight to
    // 501 and so passed under an off-by-one in either direction.
    await recordIssue(issue(), { userId: null });
    await db
      .update(issueGroups)
      .set({ eventCount: 498 })
      .where(eq(issueGroups.fingerprint, "f".repeat(64)));

    await recordIssue(issue(), { userId: null }); // 499 — inserts
    await recordIssue(issue(), { userId: null }); // 500 — inserts, the cap
    expect(await db.select().from(issueEvents)).toHaveLength(3);

    await recordIssue(issue(), { userId: null }); // 501 — counted, not stored
    expect(await db.select().from(issueEvents)).toHaveLength(3);

    const [group] = await db.select().from(issueGroups);
    expect(group!.eventCount).toBe(501);
  });

  it("stores the structural context and no other keys", async () => {
    await recordIssue(issue(), { userId: null });
    const [event] = await db.select().from(issueEvents);
    expect(event!.context).toEqual({ phase: "judging" });
    expect(event!.lobbyCode).toBe("AB2C");
  });
});
