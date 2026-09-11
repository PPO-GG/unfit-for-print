import { describe, it, expect } from "vitest";
import { legacyAttachmentToLayers, resolveLayers } from "#shared/decorationLegacy";
import type { ImageLayer, LottieLayer } from "#shared/decorationLayers";

const attachment = (over: Record<string, unknown> = {}) => ({
  anchor: "top-center", offsetX: 0, offsetY: -0.35, scale: 0.6, speed: 1,
  rotation: 0, zLayer: "above", clipped: false, ...over,
});

describe("legacyAttachmentToLayers", () => {
  it("returns an empty stack when there is no image", () => {
    expect(legacyAttachmentToLayers({ imageKey: null, imageFormat: null })).toEqual({ v: 1, layers: [] });
  });

  it("maps a png attachment to one front image layer", () => {
    const out = legacyAttachmentToLayers({ imageKey: "k.png", imageFormat: "png", attachment: attachment() });
    const layer = out.layers[0] as ImageLayer;
    expect(out.layers).toHaveLength(1);
    expect(layer.type).toBe("image");
    expect(layer.side).toBe("front");
    expect(layer.asset).toEqual({ key: "k.png", format: "png" });
    expect(layer.transform.x).toBeCloseTo(0);
    expect(layer.transform.y).toBeCloseTo(-0.85);
    expect(layer.transform.scale).toBeCloseTo(0.6);
  });

  it.each([
    ["top-left", -0.5, -0.5],
    ["top-center", 0, -0.5],
    ["top-right", 0.5, -0.5],
    ["center", 0, 0],
    ["bottom-center", 0, 0.5],
  ])("adds the %s anchor point to the offset", (anchor, ax, ay) => {
    const out = legacyAttachmentToLayers({
      imageKey: "k.png", imageFormat: "png",
      attachment: attachment({ anchor, offsetX: 0.1, offsetY: 0.2 }),
    });
    const t = (out.layers[0] as ImageLayer).transform;
    expect(t.x).toBeCloseTo(ax + 0.1);
    expect(t.y).toBeCloseTo(ay + 0.2);
  });

  it("maps below/clipped and lottie speed", () => {
    const out = legacyAttachmentToLayers({
      imageKey: "a.lottie", imageFormat: "dotlottie",
      attachment: attachment({ zLayer: "below", clipped: true, speed: 2 }),
    });
    const layer = out.layers[0] as LottieLayer;
    expect(layer.type).toBe("lottie");
    expect(layer.side).toBe("behind");
    expect(layer.clip).toBe(true);
    expect(layer.speed).toBe(2);
  });

  it("uses the old editor defaults when the attachment column is null", () => {
    const out = legacyAttachmentToLayers({ imageKey: "k.webp", imageFormat: "webp", attachment: null });
    expect((out.layers[0] as ImageLayer).transform.y).toBeCloseTo(-0.85);
  });
});

describe("resolveLayers", () => {
  it("prefers a non-null layers column over the legacy fields", () => {
    const out = resolveLayers({
      layers: { v: 1, layers: [{ type: "glow", id: "g" }] },
      imageKey: "k.png", imageFormat: "png", attachment: attachment(),
    });
    expect(out.layers.map((l) => l.type)).toEqual(["glow"]);
  });

  it("falls back to the legacy conversion when layers is null", () => {
    const out = resolveLayers({ layers: null, imageKey: "k.png", imageFormat: "png", attachment: attachment() });
    expect(out.layers[0]?.type).toBe("image");
  });
});
