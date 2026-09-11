/**
 * The inspector is generic: it renders whatever this schema lists for the
 * selected layer's type. Ranges come from RANGES, the same table the
 * normaliser clamps against, so a slider can never offer a value the
 * server would silently change.
 */
import { RANGES, type Layer, type LayerType } from "#shared/decorationLayers";

type When = { when?: (layer: Layer) => boolean };
export type FieldDef = When &
  (
    | { kind: "range"; key: string; label: string; min: number; max: number; step: number; unit: string; percent?: boolean }
    | { kind: "select"; key: string; label: string; options: { label: string; value: string }[] }
    | { kind: "color"; key: string; label: string }
    | { kind: "colors"; key: string; label: string; min: number; max: number }
    | { kind: "toggle"; key: string; label: string }
    | { kind: "fill"; key: "fill"; label: string }
    | { kind: "asset"; key: "asset"; label: string; accept: string }
    | { kind: "transform"; key: "transform"; label: string }
  );

const range = (key: keyof typeof RANGES, label: string, step: number, unit = "", percent = false): FieldDef => ({
  kind: "range", key, label, min: RANGES[key][0], max: RANGES[key][1], step, unit, percent,
});
const select = (key: string, label: string, values: string[]): FieldDef => ({
  kind: "select", key, label,
  options: values.map((v) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v })),
});

const IMAGE_ACCEPT = "image/png,image/webp,image/gif,image/svg+xml";

export const FIELDS: Record<LayerType, FieldDef[]> = {
  glow: [
    { kind: "color", key: "color", label: "Colour" },
    range("spread", "Spread", 0.01, "%", true),
    range("softness", "Softness", 0.05, "%", true),
    select("animation", "Animation", ["none", "pulse", "breathe"]),
    range("duration", "Speed", 0.5, "s"),
  ],
  ring: [
    { kind: "fill", key: "fill", label: "Fill" },
    range("thickness", "Thickness", 0.005, "%", true),
    range("gap", "Gap", 0.01, "%", true),
    select("dash", "Style", ["none", "dashed", "dotted"]),
    select("animation", "Animation", ["none", "spin", "pulse"]),
    range("duration", "Speed", 0.5, "s"),
    select("direction", "Direction", ["cw", "ccw"]),
  ],
  particles: [
    select("shape", "Shape", ["sparkle", "star", "dot", "heart", "plus", "image"]),
    { kind: "asset", key: "asset", label: "Particle image", accept: IMAGE_ACCEPT, when: (l) => l.type === "particles" && l.shape === "image" },
    range("count", "Count", 1),
    range("size", "Size", 0.01, "%", true),
    range("sizeVariance", "Size variation", 0.05, "%", true),
    { kind: "colors", key: "colors", label: "Colours", min: 1, max: 6 },
    select("motion", "Motion", ["orbit", "rise", "fall", "twinkle"]),
    range("radius", "Radius", 0.01, "%", true),
    range("duration", "Speed", 0.5, "s"),
    select("direction", "Direction", ["cw", "ccw"]),
    { kind: "toggle", key: "twinkle", label: "Twinkle" },
  ],
  image: [
    { kind: "asset", key: "asset", label: "Image (PNG, WebP, GIF, SVG)", accept: IMAGE_ACCEPT },
    { kind: "transform", key: "transform", label: "Position" },
    select("idle", "Idle motion", ["none", "bob", "sway", "spin", "pulse"]),
    range("duration", "Speed", 0.5, "s"),
  ],
  lottie: [
    { kind: "asset", key: "asset", label: "Animation (.json, .lottie)", accept: ".json,.lottie,application/json" },
    { kind: "transform", key: "transform", label: "Position" },
    range("speed", "Playback", 0.05, "×"),
  ],
};

export const COMMON_FIELDS: FieldDef[] = [
  range("opacity", "Opacity", 0.05, "%", true),
  select("blend", "Blend", ["normal", "screen", "plus-lighter"]),
  select("side", "Side", ["behind", "front"]),
  { kind: "toggle", key: "clip", label: "Clip to avatar circle" },
];

export const LAYER_LABELS: Record<LayerType, string> = {
  glow: "Glow", ring: "Ring", particles: "Particles", image: "Image", lottie: "Lottie",
};

export const LAYER_ICONS: Record<LayerType, string> = {
  glow: "i-lucide-sun",
  ring: "i-lucide-circle-dashed",
  particles: "i-lucide-sparkles",
  image: "i-lucide-image",
  lottie: "i-lucide-film",
};
