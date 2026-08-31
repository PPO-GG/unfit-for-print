import { describe, expect, it } from "vitest";
import { applyVolume, clampVolumePercent, normalizeVolumePercent } from "~/utils/volume";

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

  it("treats non-finite values as silence", () => {
    expect(normalizeVolumePercent(Infinity)).toBe(0);
    expect(normalizeVolumePercent(-Infinity)).toBe(0);
  });
});

describe("clampVolumePercent", () => {
  it("rounds and clamps to the 0-100 range", () => {
    expect(clampVolumePercent(42.6)).toBe(43);
    expect(clampVolumePercent(150)).toBe(100);
    expect(clampVolumePercent(-20)).toBe(0);
  });

  it("treats non-finite values as silence", () => {
    expect(clampVolumePercent(NaN)).toBe(0);
    expect(clampVolumePercent(Infinity)).toBe(0);
  });
});

describe("applyVolume", () => {
  it("sets the target's volume from a percentage", () => {
    const target = { volume: 1 };
    applyVolume(target, 40);
    expect(target.volume).toBeCloseTo(0.4);
  });
});
