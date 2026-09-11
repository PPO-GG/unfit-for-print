import { describe, it, expect } from "vitest";
import {
  addLayer, removeLayer, duplicateLayer, updateLayer, moveLayer, sideLists, buildSavePayload,
} from "~/utils/decorationStack";
import { normalizeLayers, MAX_LAYERS, type RingLayer } from "#shared/decorationLayers";

const base = () =>
  normalizeLayers({
    v: 1,
    layers: [
      { type: "ring", id: "b1", side: "behind" },
      { type: "glow", id: "f1", side: "front" },
      { type: "glow", id: "b2", side: "behind" },
    ],
  });
const ids = (layers: { id: string }[]) => layers.map((l) => l.id);

describe("stack ops", () => {
  it("lists each side top-first", () => {
    const { front, behind } = sideLists(base());
    expect(ids(front)).toEqual(["f1"]);
    expect(ids(behind)).toEqual(["b2", "b1"]);
  });

  it("adds a layer on top of its default side and refuses past the cap", () => {
    const { stack, id } = addLayer(base(), "image");
    expect(sideLists(stack).front[0]?.id).toBe(id);
    let full = base();
    while (full.layers.length < MAX_LAYERS) full = addLayer(full, "glow").stack;
    expect(addLayer(full, "glow").id).toBeNull();
  });

  it("removes and duplicates without mutating the input", () => {
    const input = base();
    expect(ids(removeLayer(input, "f1").layers)).toEqual(["b1", "b2"]);
    const dup = duplicateLayer(input, "b1");
    expect(dup.stack.layers).toHaveLength(4);
    expect(dup.stack.layers[1]?.id).toBe(dup.id);
    expect(dup.stack.layers[1]?.name).toMatch(/copy$/);
    expect(input.layers).toHaveLength(3);
  });

  it("updates one layer and re-normalises it", () => {
    const next = updateLayer(base(), "b1", { thickness: 99, name: "Gold" });
    const ring = next.layers[0] as RingLayer;
    expect(ring.thickness).toBe(0.25);
    expect(ring.name).toBe("Gold");
    expect(next.layers[0]).not.toBe(base().layers[0]);
  });

  it("moves across the avatar and within a side", () => {
    const toBehindTop = moveLayer(base(), "f1", "behind", 0);
    expect(ids(sideLists(toBehindTop).behind)).toEqual(["f1", "b2", "b1"]);
    expect(sideLists(toBehindTop).front).toHaveLength(0);

    const toFrontBottom = moveLayer(base(), "b1", "front", 1);
    expect(ids(sideLists(toFrontBottom).front)).toEqual(["f1", "b1"]);

    const reorder = moveLayer(base(), "b1", "behind", 0);
    expect(ids(sideLists(reorder).behind)).toEqual(["b1", "b2"]);
  });

  it("moveLayer with an unknown id returns the same stack", () => {
    const input = base();
    expect(moveLayer(input, "nope", "front", 0)).toBe(input);
  });

  it("moveLayer into an empty side", () => {
    const stack = normalizeLayers({
      v: 1,
      layers: [
        { type: "ring", id: "b1", side: "behind" },
        { type: "glow", id: "b2", side: "behind" },
      ],
    });
    const result = moveLayer(stack, "b1", "front", 0);
    expect(ids(sideLists(result).front)).toEqual(["b1"]);
    expect(ids(sideLists(result).behind)).toEqual(["b2"]);
  });

  it("moveLayer clamps an out-of-range topIndex to the bottom of the side", () => {
    const result = moveLayer(base(), "f1", "behind", 99);
    expect(ids(sideLists(result).behind)).toEqual(["b2", "b1", "f1"]);
  });

  it("duplicateLayer refuses at the cap and for an unknown id", () => {
    let full = base();
    while (full.layers.length < MAX_LAYERS) full = addLayer(full, "glow").stack;
    expect(duplicateLayer(full, full.layers[0]!.id).id).toBeNull();
    expect(duplicateLayer(full, full.layers[0]!.id).stack).toBe(full);
    expect(duplicateLayer(base(), "nope").id).toBeNull();
  });

  it("duplicateLayer deep-copies nested objects", () => {
    const stack = normalizeLayers({
      v: 1,
      layers: [
        { type: "ring", id: "r", fill: { kind: "conic", stops: ["#000", "#fff"], angle: 0 } },
      ],
    });
    const dup = duplicateLayer(stack, "r");
    const copy = dup.stack.layers.find((l) => l.id === dup.id);
    const source = stack.layers[0];
    if (copy && "fill" in copy && source && "fill" in source) {
      expect(copy.fill).toEqual(source.fill);
      expect(copy.fill).not.toBe(source.fill);
    }
  });
});

describe("buildSavePayload", () => {
  it("coerces listing fields and normalises the stack", () => {
    const payload = buildSavePayload(
      {
        name: "Halo", description: "", rarity: "rare", category: "effect", enabled: true,
        freeForAll: false, discordSkuId: "  ", price: "2.5" as unknown as number, sortOrder: 3.7,
      },
      { v: 1, layers: [{ type: "glow", id: "g", spread: 9 } as never] },
    );
    expect(payload).toMatchObject({ name: "Halo", discordSkuId: null, price: 2.5, sortOrder: 4 });
    expect((payload.layers as { layers: { spread: number }[] }).layers[0]?.spread).toBe(0.6);
  });
});
