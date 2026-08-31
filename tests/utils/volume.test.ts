import { describe, expect, it } from "vitest";
import { normalizeVolumePercent } from "~/utils/volume";

describe("normalizeVolumePercent", () => {
  it("converts a 0-100 percentage to a 0-1 multiplier", () => {
    expect(normalizeVolumePercent(50)).toBeCloseTo(0.5);
    expect(normalizeVolumePercent(0)).toBe(0);
    expect(normalizeVolumePercent(100)).toBe(1);
  });

  it("clamps values outside the 0-100 range", () => {
    expect(normalizeVolumePercent(150)).toBe(1);
    expect(normalizeVolumePercent(-20)).toBe(0);
  });

  it("treats NaN as silence", () => {
    expect(normalizeVolumePercent(NaN)).toBe(0);
  });
});
