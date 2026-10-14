// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fillWeeklyGaps } from "~/server/utils/feedbackStats";

describe("fillWeeklyGaps", () => {
  // 2026-10-14 is a Wednesday; its ISO week starts Monday 2026-10-12.
  const now = new Date("2026-10-14T15:00:00Z");

  it("returns 12 Monday-keyed weeks, oldest first, ending this week", () => {
    const out = fillWeeklyGaps([], now);
    expect(out).toHaveLength(12);
    expect(out[11]!.weekStart).toBe("2026-10-12");
    expect(out[0]!.weekStart).toBe("2026-07-27");
    expect(out.every((w) => w.count === 0 && w.avgRating === null)).toBe(true);
  });

  it("slots real rows into their week", () => {
    const out = fillWeeklyGaps(
      [{ weekStart: "2026-10-05", avgRating: 4.25, count: 8 }],
      now,
    );
    expect(out[10]).toEqual({ weekStart: "2026-10-05", avgRating: 4.25, count: 8 });
  });

  it("ignores rows outside the window", () => {
    const out = fillWeeklyGaps(
      [{ weekStart: "2025-01-06", avgRating: 1, count: 1 }],
      now,
    );
    expect(out.some((w) => w.weekStart === "2025-01-06")).toBe(false);
  });
});
