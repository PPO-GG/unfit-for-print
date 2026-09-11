/**
 * The decoration layer model, shared verbatim by the renderer, the studio and
 * the Nitro routes. `normalizeLayers` is the only validator: the server runs
 * it on save and the client runs it on load, so the two can never disagree.
 */
import { isSafeAssetKey } from "./decorationAssets";

export type AssetFormat = "png" | "webp" | "gif" | "svg" | "lottie" | "dotlottie";
export interface AssetRef { key: string; format: AssetFormat }
export interface Transform { x: number; y: number; scale: number; rotation: number }
export type LayerSide = "behind" | "front";
export type LayerBlend = "normal" | "screen" | "plus-lighter";
export type Direction = "cw" | "ccw";

interface LayerBase {
  id: string;
  name?: string;
  visible: boolean;
  opacity: number;
  side: LayerSide;
  clip: boolean;
  blend: LayerBlend;
}

export interface GlowLayer extends LayerBase {
  type: "glow";
  color: string;
  spread: number;
  softness: number;
  animation: "none" | "pulse" | "breathe";
  duration: number;
}

export type RingFill =
  | { kind: "solid"; color: string }
  | { kind: "conic" | "linear"; stops: string[]; angle: number };

export interface RingLayer extends LayerBase {
  type: "ring";
  thickness: number;
  gap: number;
  fill: RingFill;
  dash: "none" | "dashed" | "dotted";
  animation: "none" | "spin" | "pulse";
  duration: number;
  direction: Direction;
}

export type ParticleShape = "sparkle" | "star" | "dot" | "heart" | "plus" | "image";

export interface ParticlesLayer extends LayerBase {
  type: "particles";
  shape: ParticleShape;
  asset: AssetRef | null;
  count: number;
  size: number;
  sizeVariance: number;
  colors: string[];
  motion: "orbit" | "rise" | "fall" | "twinkle";
  radius: number;
  duration: number;
  direction: Direction;
  twinkle: boolean;
}

export interface ImageLayer extends LayerBase {
  type: "image";
  asset: AssetRef | null;
  transform: Transform;
  idle: "none" | "bob" | "sway" | "spin" | "pulse";
  duration: number;
}

export interface LottieLayer extends LayerBase {
  type: "lottie";
  asset: AssetRef | null;
  transform: Transform;
  speed: number;
}

export type Layer = GlowLayer | RingLayer | ParticlesLayer | ImageLayer | LottieLayer;
export type LayerType = Layer["type"];
export interface DecorationLayers { v: 1; layers: Layer[] }

export const LAYER_TYPES: LayerType[] = ["glow", "ring", "particles", "image", "lottie"];
export const MAX_LAYERS = 12;
export const MAX_PARTICLES = 24;
export const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** [min, max] for every numeric field. The inspector reads these too. */
export const RANGES = {
  opacity: [0, 1],
  duration: [0.5, 30],
  spread: [0, 0.6],
  softness: [0, 1],
  thickness: [0.01, 0.25],
  gap: [0, 0.5],
  angle: [0, 360],
  count: [1, MAX_PARTICLES],
  size: [0.02, 0.3],
  sizeVariance: [0, 1],
  radius: [0.3, 1.2],
  speed: [0.1, 3],
  x: [-1.5, 1.5],
  y: [-1.5, 1.5],
  scale: [0.1, 8],
  rotation: [-180, 180],
} as const satisfies Record<string, readonly [number, number]>;

const IMAGE_FORMATS: AssetFormat[] = ["png", "webp", "gif", "svg"];
const LOTTIE_FORMATS: AssetFormat[] = ["lottie", "dotlottie"];

export const DEFAULT_TRANSFORM: Transform = { x: 0, y: -0.5, scale: 0.6, rotation: 0 };

export function newLayerId(): string {
  return `l${Math.random().toString(36).slice(2, 10)}`;
}

export function isTransformable(l: Layer): l is ImageLayer | LottieLayer {
  return l.type === "image" || l.type === "lottie";
}

// ─── Field coercers ──────────────────────────────────────────────────────
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

function num(v: unknown, key: keyof typeof RANGES, def: number): number {
  const [min, max] = RANGES[key];
  if (typeof v !== "number" || !Number.isFinite(v)) return def;
  return Math.min(max, Math.max(min, v));
}
function int(v: unknown, key: keyof typeof RANGES, def: number): number {
  return Math.round(num(v, key, def));
}
function oneOf<T extends string>(v: unknown, options: readonly T[], def: T): T {
  return options.includes(v as T) ? (v as T) : def;
}
function color(v: unknown, def: string): string {
  return typeof v === "string" && HEX_COLOR.test(v) ? v : def;
}
function colors(v: unknown, def: string[], min: number, max: number): string[] {
  const list = Array.isArray(v) ? v.filter((c): c is string => typeof c === "string" && HEX_COLOR.test(c)) : [];
  return list.length >= min ? list.slice(0, max) : def;
}
function bool(v: unknown, def: boolean): boolean {
  return typeof v === "boolean" ? v : def;
}
function asset(v: unknown, formats: AssetFormat[]): AssetRef | null {
  if (!isObj(v) || !isSafeAssetKey(v.key)) return null;
  return formats.includes(v.format as AssetFormat) ? { key: v.key, format: v.format as AssetFormat } : null;
}
function transform(v: unknown): Transform {
  const t = isObj(v) ? v : {};
  return {
    x: num(t.x, "x", DEFAULT_TRANSFORM.x),
    y: num(t.y, "y", DEFAULT_TRANSFORM.y),
    scale: num(t.scale, "scale", DEFAULT_TRANSFORM.scale),
    rotation: num(t.rotation, "rotation", DEFAULT_TRANSFORM.rotation),
  };
}
function ringFill(v: unknown): RingFill {
  const fallback: RingFill = { kind: "conic", stops: ["#b45309", "#fde047", "#f59e0b", "#b45309"], angle: 0 };
  if (!isObj(v)) return fallback;
  if (v.kind === "solid") return { kind: "solid", color: color(v.color, "#f59e0b") };
  if (v.kind === "conic" || v.kind === "linear") {
    return { kind: v.kind, stops: colors(v.stops, fallback.stops, 2, 6), angle: num(v.angle, "angle", 0) };
  }
  return fallback;
}

// ─── Per-type normalisers ────────────────────────────────────────────────
const DEFAULT_SIDE: Record<LayerType, LayerSide> = {
  glow: "behind",
  ring: "behind",
  particles: "front",
  image: "front",
  lottie: "front",
};

function base(r: Obj, type: LayerType) {
  return {
    id: typeof r.id === "string" && r.id.length > 0 && r.id.length <= 40 ? r.id : newLayerId(),
    ...(typeof r.name === "string" && r.name.trim() ? { name: r.name.trim().slice(0, 40) } : {}),
    visible: bool(r.visible, true),
    opacity: num(r.opacity, "opacity", 1),
    side: oneOf(r.side, ["behind", "front"] as const, DEFAULT_SIDE[type]),
    clip: bool(r.clip, false),
    blend: oneOf(r.blend, ["normal", "screen", "plus-lighter"] as const, "normal"),
  };
}

function normalizeLayer(raw: unknown): Layer | null {
  if (!isObj(raw)) return null;
  switch (raw.type) {
    case "glow":
      return {
        ...base(raw, "glow"),
        type: "glow",
        color: color(raw.color, "#f59e0b66"),
        spread: num(raw.spread, "spread", 0.12),
        softness: num(raw.softness, "softness", 0.6),
        animation: oneOf(raw.animation, ["none", "pulse", "breathe"] as const, "pulse"),
        duration: num(raw.duration, "duration", 4),
      };
    case "ring":
      return {
        ...base(raw, "ring"),
        type: "ring",
        thickness: num(raw.thickness, "thickness", 0.03),
        gap: num(raw.gap, "gap", 0),
        fill: ringFill(raw.fill),
        dash: oneOf(raw.dash, ["none", "dashed", "dotted"] as const, "none"),
        animation: oneOf(raw.animation, ["none", "spin", "pulse"] as const, "spin"),
        duration: num(raw.duration, "duration", 6),
        direction: oneOf(raw.direction, ["cw", "ccw"] as const, "cw"),
      };
    case "particles":
      return {
        ...base(raw, "particles"),
        type: "particles",
        shape: oneOf(raw.shape, ["sparkle", "star", "dot", "heart", "plus", "image"] as const, "sparkle"),
        asset: asset(raw.asset, IMAGE_FORMATS),
        count: int(raw.count, "count", 8),
        size: num(raw.size, "size", 0.06),
        sizeVariance: num(raw.sizeVariance, "sizeVariance", 0.3),
        colors: colors(raw.colors, ["#fde047"], 1, 6),
        motion: oneOf(raw.motion, ["orbit", "rise", "fall", "twinkle"] as const, "orbit"),
        radius: num(raw.radius, "radius", 0.7),
        duration: num(raw.duration, "duration", 10),
        direction: oneOf(raw.direction, ["cw", "ccw"] as const, "cw"),
        twinkle: bool(raw.twinkle, true),
      };
    case "image":
      return {
        ...base(raw, "image"),
        type: "image",
        asset: asset(raw.asset, IMAGE_FORMATS),
        transform: transform(raw.transform),
        idle: oneOf(raw.idle, ["none", "bob", "sway", "spin", "pulse"] as const, "none"),
        duration: num(raw.duration, "duration", 3),
      };
    case "lottie":
      return {
        ...base(raw, "lottie"),
        type: "lottie",
        asset: asset(raw.asset, LOTTIE_FORMATS),
        transform: transform(raw.transform),
        speed: num(raw.speed, "speed", 1),
      };
    default:
      return null;
  }
}

export function createLayer(type: LayerType, id: string = newLayerId()): Layer {
  return normalizeLayer({ type, id }) as Layer;
}

/** Never throws. Anything unusable becomes an empty stack. */
export function normalizeLayers(input: unknown): DecorationLayers {
  let value = input;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return { v: 1, layers: [] };
    }
  }
  if (!isObj(value) || !Array.isArray(value.layers)) return { v: 1, layers: [] };

  const seen = new Set<string>();
  const layers: Layer[] = [];
  for (const raw of value.layers) {
    const layer = normalizeLayer(raw);
    if (!layer) continue;
    if (seen.has(layer.id)) layer.id = newLayerId();
    seen.add(layer.id);
    layers.push(layer);
    if (layers.length === MAX_LAYERS) break;
  }
  return { v: 1, layers };
}
