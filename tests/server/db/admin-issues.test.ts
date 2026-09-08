import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { issueEvents, issueGroups } from "~/server/db/schema";
import listHandler from "~/server/api/admin/issues/index.get";
import statusHandler from "~/server/api/admin/issues/status.post";

// requireAdmin queries a real admin user; these tests are about the routes'
// filtering and validation, not the guard. Vitest hoists vi.mock above the
// imports, so this must stay at module top level.
vi.mock("~~/server/utils/session", () => ({
  requireAdmin: async () => "00000000-0000-0000-0000-000000000001",
}));

const db = useDb();

function mockEvent() {
  return { node: { req: {}, res: {} } } as any;
}

beforeEach(async () => {
  await db.delete(issueEvents);
  await db.delete(issueGroups);
  globalThis.getQuery = () => ({});
});

async function seed() {
  return db
    .insert(issueGroups)
    .values([
      {
        fingerprint: "a".repeat(64),
        kind: "client-error",
        title: "older error",
        eventCount: 3,
        lastSeen: new Date("2026-09-01T00:00:00Z"),
      },
      {
        fingerprint: "b".repeat(64),
        kind: "player-report",
        title: "newer report",
        eventCount: 1,
        lastSeen: new Date("2026-09-08T00:00:00Z"),
      },
    ])
    .returning();
}

describe("GET /api/admin/issues", () => {
  it("returns groups newest-first", async () => {
    await seed();
    const result = await listHandler(mockEvent());
    expect(result.groups.map((g: any) => g.title)).toEqual([
      "newer report",
      "older error",
    ]);
  });

  it("filters by kind", async () => {
    await seed();
    globalThis.getQuery = () => ({ kind: "player-report" });
    const result = await listHandler(mockEvent());
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].title).toBe("newer report");
  });

  it("filters by status", async () => {
    const [first] = await seed();
    await db
      .update(issueGroups)
      .set({ status: "resolved" })
      .where(eq(issueGroups.id, first!.id));
    globalThis.getQuery = () => ({ status: "resolved" });
    const result = await listHandler(mockEvent());
    expect(result.groups).toHaveLength(1);
  });
});

describe("POST /api/admin/issues/status", () => {
  it("sets a group to resolved", async () => {
    const [group] = await seed();
    globalThis.readBody = async () => ({ id: group!.id, status: "resolved" });

    const result = await statusHandler(mockEvent());
    expect(result.group.status).toBe("resolved");
  });

  it("rejects an invalid status", async () => {
    const [group] = await seed();
    globalThis.readBody = async () => ({ id: group!.id, status: "banana" });
    await expect(statusHandler(mockEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
