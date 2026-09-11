import { describe, it, expect } from "vitest";
import {
  normalizeLayers,
  createLayer,
  MAX_LAYERS,
  MAX_PARTICLES,
  type RingLayer,
  type ParticlesLayer,
  type ImageLayer,
} from "#shared/decorationLayers";

describe("createLayer", () => {
  it("creates each type with sane defaults and a unique id", () => {
    const a = createLayer("glow");
    const b = createLayer("glow");
    expect(a.type).toBe("glow");
    expect(a.side).toBe("behind");
    expect(a.id).not.toBe(b.id);
    expect(createLayer("image").side).toBe("front");
    expect((createLayer("image") as ImageLayer).transform).toEqual({ x: 0, y: -0.5, scale: 0.6, rotation: 0 });
  });
});

describe("normalizeLayers", () => {
  it("never throws and returns an empty stack for garbage", () => {
    for (const bad of [null, undefined, 42, "nope", "{", [], { v: 1 }, { layers: "x" }]) {
      expect(normalizeLayers(bad)).toEqual({ v: 1, layers: [] });
    }
  });

  it("accepts a JSON string", () => {
    const json = JSON.stringify({ v: 1, layers: [{ type: "glow", id: "g1" }] });
    expect(normalizeLayers(json).layers[0]?.id).toBe("g1");
  });

  it("drops unknown layer types instead of failing", () => {
    const out = normalizeLayers({ v: 1, layers: [{ type: "laser" }, { type: "glow", id: "g" }] });
    expect(out.layers.map((l) => l.type)).toEqual(["glow"]);
  });

  it("clamps numbers into range and replaces NaN with the default", () => {
    const out = normalizeLayers({
      v: 1,
      layers: [
        { type: "ring", id: "r", thickness: 9, duration: -5, opacity: Number.NaN },
        { type: "image", id: "i", transform: { x: 99, y: -99, scale: 50, rotation: 720 } },
      ],
    });
    const ring = out.layers[0] as RingLayer;
    expect(ring.thickness).toBe(0.25);
    expect(ring.duration).toBe(0.5);
    expect(ring.opacity).toBe(1);
    const img = out.layers[1] as ImageLayer;
    expect(img.transform).toEqual({ x: 1.5, y: -1.5, scale: 8, rotation: 180 });
  });

  it("rejects non-hex colours so layer JSON can't inject CSS", () => {
    const out = normalizeLayers({
      v: 1,
      layers: [
        { type: "glow", id: "g", color: "red; background:url(x)" },
        { type: "particles", id: "p", colors: ["#fff", "url(x)", "#12345678"] },
      ],
    });
    expect((out.layers[0] as { color: string }).color).toBe("#f59e0b66");
    expect((out.layers[1] as ParticlesLayer).colors).toEqual(["#fff", "#12345678"]);
  });

  it("caps the stack at MAX_LAYERS and particle count at MAX_PARTICLES", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ type: "glow", id: `g${i}` }));
    expect(normalizeLayers({ v: 1, layers: many }).layers).toHaveLength(MAX_LAYERS);
    const p = normalizeLayers({ v: 1, layers: [{ type: "particles", id: "p", count: 500 }] }).layers[0] as ParticlesLayer;
    expect(p.count).toBe(MAX_PARTICLES);
  });

  it("keeps a valid ring gradient and falls back when stops are bad", () => {
    const ok = normalizeLayers({
      v: 1,
      layers: [{ type: "ring", id: "r", fill: { kind: "conic", stops: ["#000", "#fff"], angle: 45 } }],
    }).layers[0] as RingLayer;
    expect(ok.fill).toEqual({ kind: "conic", stops: ["#000", "#fff"], angle: 45 });
    const bad = normalizeLayers({
      v: 1,
      layers: [{ type: "ring", id: "r", fill: { kind: "conic", stops: ["nope"] } }],
    }).layers[0] as RingLayer;
    expect(bad.fill.kind).toBe("conic");
    expect((bad.fill as { stops: string[] }).stops.length).toBeGreaterThanOrEqual(2);
  });

  it("drops asset refs with unsafe keys or formats that don't fit the layer", () => {
    const out = normalizeLayers({
      v: 1,
      layers: [
        { type: "image", id: "a", asset: { key: "../etc/passwd", format: "png" } },
        { type: "image", id: "b", asset: { key: "deco-1-hat.png", format: "lottie" } },
        { type: "image", id: "c", asset: { key: "deco-1-hat.svg", format: "svg" } },
      ],
    });
    expect(out.layers.map((l) => (l as ImageLayer).asset)).toEqual([
      null,
      null,
      { key: "deco-1-hat.svg", format: "svg" },
    ]);
  });

  it("regenerates duplicate or missing ids", () => {
    const out = normalizeLayers({ v: 1, layers: [{ type: "glow", id: "x" }, { type: "glow", id: "x" }, { type: "glow" }] });
    const ids = out.layers.map((l) => l.id);
    expect(ids[0]).toBe("x");
    expect(new Set(ids).size).toBe(3);
  });
});
