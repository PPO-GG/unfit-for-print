/**
 * Size-awareness for layers. Everything is authored at 128px and scaled to
 * the measured avatar with the sqrt curves FounderRing used by hand, so a
 * stack thins itself out at 24px instead of turning to mush.
 */
import type { ParticlesLayer } from "./decorationLayers";

export const AUTHORED_PX = 128;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function strokePx(avatarPx: number, fraction: number): number {
  return Math.max(2, Math.round(avatarPx * fraction));
}

export function particleCount(avatarPx: number, count: number): number {
  return Math.max(1, Math.round(count * clamp(Math.sqrt(avatarPx / AUTHORED_PX), 0.35, 1)));
}

export function particleSizePx(avatarPx: number, size: number): number {
  return Math.max(3, Math.round(size * AUTHORED_PX * Math.sqrt(avatarPx / AUTHORED_PX)));
}

/** FNV-1a hash of the seed feeding mulberry32: tiny, fast, deterministic. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ParticleSpec {
  /** Degrees around the centre, for orbit/twinkle. */
  angle: number;
  /** 0–1 across the band, for rise/fall. */
  lane: number;
  sizePx: number;
  color: string;
  /** Negative, so every particle starts mid-cycle instead of in lockstep. */
  delay: number;
}

type PlaceInput = Pick<ParticlesLayer, "id" | "count" | "size" | "sizeVariance" | "colors" | "duration">;

export function placeParticles(layer: PlaceInput, avatarPx: number): ParticleSpec[] {
  const n = particleCount(avatarPx, layer.count);
  const rand = seededRandom(layer.id);
  const base = particleSizePx(avatarPx, layer.size);
  const step = 360 / n;
  return Array.from({ length: n }, (_, i) => {
    const r1 = rand(), r2 = rand(), r3 = rand(), r4 = rand();
    return {
      angle: i * step + (r1 - 0.5) * step * 0.5,
      lane: clamp((i + 0.5) / n + ((r2 - 0.5) / n) * 0.6, 0, 1),
      sizePx: Math.max(3, Math.round(base * (1 + (r3 * 2 - 1) * layer.sizeVariance * 0.5))),
      color: layer.colors[i % layer.colors.length] ?? "#ffffff",
      delay: -r4 * layer.duration,
    };
  });
}
