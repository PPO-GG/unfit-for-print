import { describe, it, expect } from "vitest";
import {
  strokePx,
  particleCount,
  particleSizePx,
  seededRandom,
  placeParticles,
} from "#shared/decorationGeometry";

describe("size curves", () => {
  it("never draws a stroke thinner than 2px", () => {
    expect(strokePx(24, 0.03)).toBe(2);
    expect(strokePx(128, 0.03)).toBe(4);
  });

  it("thins particle counts sub-linearly and never above the authored count", () => {
    expect(particleCount(8, 9)).toBe(3);
    expect(particleCount(24, 9)).toBe(4);
    expect(particleCount(48, 9)).toBe(6);
    expect(particleCount(128, 9)).toBe(9);
    expect(particleCount(512, 9)).toBe(9);
    expect(particleCount(24, 1)).toBe(1);
  });

  it("scales particle size by sqrt with a 3px floor", () => {
    expect(particleSizePx(128, 0.06)).toBe(8);
    expect(particleSizePx(24, 0.06)).toBe(3);
  });
});

describe("seededRandom / placeParticles", () => {
  it("is deterministic per seed", () => {
    const a = seededRandom("layer-1");
    const b = seededRandom("layer-1");
    const c = seededRandom("layer-2");
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect([c(), c(), c()]).not.toEqual(seqA);
    for (const v of seqA) expect(v >= 0 && v < 1).toBe(true);
  });

  const layer = { id: "p1", count: 9, size: 0.06, sizeVariance: 0.3, colors: ["#fde047", "#fbbf24"], duration: 10 };

  it("places particleCount particles, stably across calls", () => {
    const first = placeParticles(layer, 128);
    expect(first).toHaveLength(9);
    expect(placeParticles(layer, 128)).toEqual(first);
    expect(placeParticles(layer, 24)).toHaveLength(4);
  });

  it("cycles colours and uses negative delays so animations start mid-cycle", () => {
    const specs = placeParticles(layer, 128);
    expect(specs[0]?.color).toBe("#fde047");
    expect(specs[1]?.color).toBe("#fbbf24");
    expect(specs[2]?.color).toBe("#fde047");
    for (const s of specs) {
      expect(s.delay).toBeLessThanOrEqual(0);
      expect(s.delay).toBeGreaterThanOrEqual(-10);
      expect(s.lane).toBeGreaterThanOrEqual(0);
      expect(s.lane).toBeLessThanOrEqual(1);
      expect(s.sizePx).toBeGreaterThanOrEqual(3);
    }
  });
});
