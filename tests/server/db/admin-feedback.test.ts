import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDb } from "~/server/db/client";
import { feedback } from "~/server/db/schema";
import handler from "~/server/api/admin/feedback.get";

vi.mock("~~/server/utils/session", () => ({
  requireAdmin: async () => "00000000-0000-0000-0000-000000000001",
}));

const db = useDb();
const DAY = 24 * 60 * 60 * 1000;

function mockEvent() {
  return { node: { req: {}, res: {} } } as any;
}

let n = 0;
function ref() {
  n += 1;
  return `3f2b8c1e-9d4a-4f6b-8a2e-${String(n).padStart(12, "0")}`;
}

async function seed() {
  const now = Date.now();
  await db.insert(feedback).values([
    { clientRef: ref(), rating: 5, source: "game_over_prompt", appVersion: "1", createdAt: new Date(now - 1 * DAY) },
    { clientRef: ref(), rating: 3, message: "more bots", topics: ["bots"], source: "game_over_prompt", appVersion: "1", createdAt: new Date(now - 2 * DAY) },
    { clientRef: ref(), rating: null, message: "dark mode is great", topics: ["look"], source: "feedback_modal", appVersion: "1", createdAt: new Date(now - 3 * DAY) },
    { clientRef: ref(), rating: 1, source: "game_over_prompt", appVersion: "1", createdAt: new Date(now - 45 * DAY) },
  ]);
}

beforeEach(async () => {
  await db.delete(feedback);
  globalThis.getQuery = () => ({});
});

describe("GET /api/admin/feedback", () => {
  it("summarises the last 30 days against the 30 before", async () => {
    await seed();
    const res = await handler(mockEvent());
    expect(res.summary.avgRating30d).toBe(4);
    expect(res.summary.avgRatingPrev30d).toBe(1);
    expect(res.summary.ratings30d).toBe(2);
    expect(res.summary.withMessagePct30d).toBe(67);
  });

  it("returns a 1–5 distribution and 12 weekly points", async () => {
    await seed();
    const res = await handler(mockEvent());
    expect(res.distribution).toEqual({ 1: 1, 2: 0, 3: 1, 4: 0, 5: 1 });
    expect(res.weekly).toHaveLength(12);
  });

  it("lists only entries with a message by default, newest first", async () => {
    await seed();
    const res = await handler(mockEvent());
    expect(res.total).toBe(2);
    expect(res.items.map((i: any) => i.message)).toEqual([
      "more bots",
      "dark mode is great",
    ]);
  });

  it("filters by topic and by rating", async () => {
    await seed();
    globalThis.getQuery = () => ({ topic: "look" });
    expect((await handler(mockEvent())).items).toHaveLength(1);
    globalThis.getQuery = () => ({ rating: "3" });
    expect((await handler(mockEvent())).items[0].message).toBe("more bots");
  });

  it("includes star-only rows when withMessage=false", async () => {
    await seed();
    globalThis.getQuery = () => ({ withMessage: "false" });
    expect((await handler(mockEvent())).total).toBe(4);
  });

  it("rejects an invalid rating or topic with 400", async () => {
    globalThis.getQuery = () => ({ rating: "9" });
    await expect(handler(mockEvent())).rejects.toMatchObject({ statusCode: 400 });
    globalThis.getQuery = () => ({ topic: "evil" });
    await expect(handler(mockEvent())).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns empty aggregates on an empty table", async () => {
    const res = await handler(mockEvent());
    expect(res.summary).toEqual({
      avgRating30d: null,
      avgRatingPrev30d: null,
      ratings30d: 0,
      withMessagePct30d: 0,
    });
    expect(res.items).toEqual([]);
  });
});
