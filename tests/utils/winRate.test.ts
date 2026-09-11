import { describe, it, expect } from "vitest";
import { winRatePercent } from "~/utils/winRate";

describe("winRatePercent", () => {
  it("is null before any rounds are played", () => {
    expect(winRatePercent(0, 0)).toBeNull();
  });

  it("rounds to a whole percent", () => {
    expect(winRatePercent(1, 3)).toBe(33);
    expect(winRatePercent(2, 3)).toBe(67);
  });

  it("reaches 100 for a perfect record and 0 for none won", () => {
    expect(winRatePercent(5, 5)).toBe(100);
    expect(winRatePercent(0, 4)).toBe(0);
  });
});
