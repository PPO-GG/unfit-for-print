import { describe, it, expect } from "vitest";
import {
  moveTransform, scaleFromPointer, rotationFromPointer, nudgeTransform, hitTest, SNAP_POINTS,
} from "~/utils/decorationStageMath";
import { normalizeLayers } from "#shared/decorationLayers";

const t = { x: 0, y: -0.5, scale: 0.6, rotation: 0 };

describe("stage maths", () => {
  it("moves in avatar diameters and clamps to ±1.5", () => {
    expect(moveTransform(t, 50, 25, 100)).toEqual({ ...t, x: 0.5, y: -0.25 });
    expect(moveTransform(t, 1000, 0, 100).x).toBe(1.5);
  });

  it("scales from the corner handle distance, clamped to 0.1–8", () => {
    expect(scaleFromPointer({ x: 0, y: 0 }, { x: 50, y: 20 }, 100)).toBe(1);
    expect(scaleFromPointer({ x: 0, y: 0 }, { x: 0, y: 0 }, 100)).toBe(0.1);
    expect(scaleFromPointer({ x: 0, y: 0 }, { x: 5000, y: 0 }, 100)).toBe(8);
  });

  it("rotates so a pointer straight above the centre is 0°", () => {
    expect(rotationFromPointer({ x: 0, y: 0 }, { x: 0, y: -10 })).toBe(0);
    expect(rotationFromPointer({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(90);
    expect(rotationFromPointer({ x: 0, y: 0 }, { x: -10, y: 0 })).toBe(-90);
  });

  it("nudges by 1% or 10% with Shift, ignoring other keys", () => {
    expect(nudgeTransform(t, "ArrowRight", false)?.x).toBe(0.01);
    expect(nudgeTransform(t, "ArrowUp", true)?.y).toBe(-0.6);
    expect(nudgeTransform(t, "a", false)).toBeNull();
  });

  it("has snap points on the avatar's edge", () => {
    expect(SNAP_POINTS.top).toEqual({ x: 0, y: -0.5 });
    expect(SNAP_POINTS["top-left"]).toEqual({ x: -0.5, y: -0.5 });
  });

  it("hit-tests transformable layers, front first, topmost first", () => {
    const stack = normalizeLayers({
      v: 1,
      layers: [
        { type: "image", id: "behind", side: "behind", transform: { x: 0, y: 0, scale: 1, rotation: 0 } },
        { type: "image", id: "front-low", side: "front", transform: { x: 0, y: 0, scale: 0.5, rotation: 0 } },
        { type: "image", id: "front-top", side: "front", transform: { x: 0.4, y: 0, scale: 0.2, rotation: 0 } },
        { type: "glow", id: "glow", side: "front" },
      ],
    });
    const c = { x: 100, y: 100 };
    expect(hitTest(stack, { x: 140, y: 100 }, c, 100)).toBe("front-top");
    expect(hitTest(stack, { x: 110, y: 100 }, c, 100)).toBe("front-low");
    expect(hitTest(stack, { x: 60, y: 60 }, c, 100)).toBe("behind");
    expect(hitTest(stack, { x: 0, y: 0 }, c, 100)).toBeNull();
  });
});
