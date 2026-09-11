/**
 * Pointer and keyboard maths for the studio stage. Positions are in avatar
 * diameters from the avatar's centre (the Transform convention), and screen
 * coordinates are converted using the stage's avatar size in px.
 */
import { RANGES, isTransformable, type DecorationLayers, type Transform } from "#shared/decorationLayers";
import { sideLists } from "./decorationStack";

export interface Point { x: number; y: number }

const clamp = (v: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, v));
const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function moveTransform(start: Transform, dxPx: number, dyPx: number, avatarPx: number): Transform {
  return {
    ...start,
    x: round3(clamp(start.x + dxPx / avatarPx, RANGES.x)),
    y: round3(clamp(start.y + dyPx / avatarPx, RANGES.y)),
  };
}

/** The corner handle sits at the box corner, so half the box = max offset. */
export function scaleFromPointer(center: Point, pointer: Point, avatarPx: number): number {
  const half = Math.max(Math.abs(pointer.x - center.x), Math.abs(pointer.y - center.y));
  return Math.round(clamp((2 * half) / avatarPx, RANGES.scale) * 100) / 100;
}

/** The rotate handle sits straight above the box, so "up" is 0°. */
export function rotationFromPointer(center: Point, pointer: Point): number {
  let deg = (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI + 90;
  if (deg > 180) deg -= 360;
  return Math.round(deg);
}

const NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function nudgeTransform(t: Transform, key: string, big: boolean): Transform | null {
  const dir = NUDGE[key];
  if (!dir) return null;
  const step = big ? 0.1 : 0.01;
  return {
    ...t,
    x: round3(clamp(t.x + dir[0] * step, RANGES.x)),
    y: round3(clamp(t.y + dir[1] * step, RANGES.y)),
  };
}

export const SNAP_POINTS = {
  top: { x: 0, y: -0.5 },
  "top-left": { x: -0.5, y: -0.5 },
  "top-right": { x: 0.5, y: -0.5 },
  center: { x: 0, y: 0 },
  bottom: { x: 0, y: 0.5 },
} as const;

/** Topmost transformable layer whose (unrotated) box contains the point. */
export function hitTest(stack: DecorationLayers, point: Point, center: Point, avatarPx: number): string | null {
  const { front, behind } = sideLists(stack);
  for (const layer of [...front, ...behind]) {
    if (!layer.visible || !isTransformable(layer)) continue;
    const { x, y, scale } = layer.transform;
    const half = (scale * avatarPx) / 2;
    const cx = center.x + x * avatarPx;
    const cy = center.y + y * avatarPx;
    if (Math.abs(point.x - cx) <= half && Math.abs(point.y - cy) <= half) return layer.id;
  }
  return null;
}
