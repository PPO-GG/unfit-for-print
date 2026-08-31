import { describe, expect, it } from "vitest";
import { getJudgingCardScale } from "~/composables/useJudgingDensity";

describe("getJudgingCardScale", () => {
  it("keeps sparse rounds at full size through six cards", () => {
    expect(getJudgingCardScale(3, 6)).toBe(1);
  });

  it("reduces dense rounds by five percent for each card above six", () => {
    expect(getJudgingCardScale(8, 8)).toBe(0.9);
  });

  it("clamps extremely dense rounds at the exact sixty percent floor", () => {
    expect(getJudgingCardScale(99, 198)).toBe(0.6);
  });
});
