import { describe, it, expect } from "vitest";
import { FIELDS, COMMON_FIELDS } from "~/utils/decorationFields";
import { createLayer, LAYER_TYPES } from "#shared/decorationLayers";

describe("inspector field schema", () => {
  it.each(LAYER_TYPES)("every %s field points at a real property with an in-range default", (type) => {
    const layer = createLayer(type) as unknown as Record<string, unknown>;
    for (const field of [...FIELDS[type], ...COMMON_FIELDS]) {
      expect(field.key in layer, `${type}.${field.key}`).toBe(true);
      const value = layer[field.key];
      if (field.kind === "range") {
        expect(value as number).toBeGreaterThanOrEqual(field.min);
        expect(value as number).toBeLessThanOrEqual(field.max);
      }
      if (field.kind === "select") {
        expect(field.options.map((o) => o.value)).toContain(value);
      }
    }
  });

  it("only shows the particle upload when the shape is image", () => {
    const assetField = FIELDS.particles.find((f) => f.key === "asset")!;
    expect(assetField.when?.(createLayer("particles"))).toBe(false);
    expect(assetField.when?.({ ...createLayer("particles"), shape: "image" } as never)).toBe(true);
  });
});
