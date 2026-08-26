import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, submissions, whiteCards } from "~/server/db/schema";

const db = useDb();
let currentUserId: string;

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return {
    ...actual,
    requireAuth: async () => currentUserId,
    requireAdmin: async () => currentUserId,
  };
});

function mockEvent(body?: unknown, query: Record<string, string> = {}) {
  globalThis.readBody = async () => body;
  globalThis.getQuery = () => query;
  return {} as any;
}

beforeEach(async () => {
  await db.delete(submissions);
  await db.delete(whiteCards);
  await db.delete(users);
  const [user] = await db.insert(users).values({ name: "Submitter" }).returning();
  currentUserId = user.id;
});

describe("submissions", () => {
  it("creates a submission attributed to the caller", async () => {
    const handler = (await import("~/server/api/submissions/create.post")).default;
    const result = await handler(mockEvent({ cardType: "white", text: "Funny card" }));
    expect(result.submitterId).toBe(currentUserId);
    expect(result.upvotes).toBe(0);
  });

  it("upvotes a submission and records the voter", async () => {
    const [sub] = await db
      .insert(submissions)
      .values({ submitterId: currentUserId, submitterName: "S", cardType: "white", text: "x" })
      .returning();

    const handler = (await import("~/server/api/submissions/upvote.post")).default;
    const result = await handler(mockEvent({ submissionId: sub.id }));
    expect(result.upvotes).toBe(1);
    expect(result.upvoterIds).toContain(currentUserId);
  });

  it("adopt creates a card and deletes the submission", async () => {
    const [sub] = await db
      .insert(submissions)
      .values({ submitterId: currentUserId, submitterName: "S", cardType: "white", text: "Adopt me" })
      .returning();

    const handler = (await import("~/server/api/submissions/adopt.post")).default;
    const result = await handler(mockEvent({ submissionId: sub.id }));
    expect(result.card.text).toBe("Adopt me");

    const remaining = await db.select().from(submissions).where(eq(submissions.id, sub.id));
    expect(remaining).toHaveLength(0);
  });
});
