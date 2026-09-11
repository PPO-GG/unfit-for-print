/**
 * FOUNDER_RING_LAYERS reproduces the hand-built FounderRing.vue as data. The
 * migration seeds the same JSON (tests/utils/decorationPresets.test.ts keeps
 * them in lockstep). STARTERS are the "New decoration → Start from" options.
 */
import { normalizeLayers, type DecorationLayers } from "./decorationLayers";

const GOLD = ["#fde047", "#fbbf24", "#fef9c3"];

export const FOUNDER_RING_LAYERS: DecorationLayers = normalizeLayers({
  v: 1,
  layers: [
    {
      id: "founder-glow", name: "Glow", type: "glow", side: "behind",
      color: "#f59e0b33", spread: 0.12, softness: 0.6, animation: "pulse", duration: 4,
    },
    {
      id: "founder-ring", name: "Gold ring", type: "ring", side: "behind",
      thickness: 0.03, gap: 0,
      fill: { kind: "conic", stops: ["#b45309", "#fde047", "#f59e0b", "#fbbf24", "#fde047", "#b45309"], angle: 0 },
      dash: "none", animation: "spin", duration: 6, direction: "cw",
    },
    {
      id: "founder-sparkles-cw", name: "Sparkles cw", type: "particles", side: "front",
      shape: "sparkle", count: 9, size: 0.06, sizeVariance: 0.3, colors: GOLD,
      motion: "orbit", radius: 0.7, duration: 10, direction: "cw", twinkle: true,
    },
    {
      id: "founder-sparkles-ccw", name: "Sparkles ccw", type: "particles", side: "front",
      shape: "sparkle", count: 4, size: 0.06, sizeVariance: 0.3, colors: GOLD,
      motion: "orbit", radius: 0.7, duration: 14, direction: "ccw", twinkle: true,
    },
  ],
});

export type StarterId = "blank" | "glow-ring" | "hat" | "sparkles";

export const STARTERS: Record<StarterId, { label: string; build: () => DecorationLayers }> = {
  blank: { label: "Blank", build: () => ({ v: 1, layers: [] }) },
  "glow-ring": {
    label: "Glow ring",
    build: () => normalizeLayers({ v: 1, layers: [{ type: "glow", name: "Glow" }, { type: "ring", name: "Ring" }] }),
  },
  hat: {
    label: "Hat (image)",
    build: () => normalizeLayers({ v: 1, layers: [{ type: "image", name: "Hat" }] }),
  },
  sparkles: {
    label: "Orbiting sparkles",
    build: () => normalizeLayers({ v: 1, layers: [{ type: "particles", name: "Sparkles" }] }),
  },
};
