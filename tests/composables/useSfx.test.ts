import { describe, expect, it } from "vitest";
import { computeSfxGain } from "~/composables/useSfx";

describe("computeSfxGain", () => {
  it("defaults the per-call volume to full when none is given", () => {
    expect(computeSfxGain(100)).toBe(1);
  });

  it("scales a full-volume sound by the master percentage", () => {
    expect(computeSfxGain(50)).toBeCloseTo(0.5);
  });

  it("composes the master percentage with an explicit per-call volume", () => {
    expect(computeSfxGain(50, 0.75)).toBeCloseTo(0.375);
  });

  it("clamps master volume percentages outside 0-100", () => {
    expect(computeSfxGain(150, 1)).toBe(1);
    expect(computeSfxGain(-20, 1)).toBe(0);
  });
});
