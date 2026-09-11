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

import { toDisplay, fromDisplay, mergeRgb } from "~/utils/decorationFields";

describe("display helpers", () => {
  const pct = FIELDS.glow.find((f) => f.key === "spread")!;
  const secs = FIELDS.glow.find((f) => f.key === "duration")!;

  it("shows percent fields ×100 and round-trips", () => {
    expect(toDisplay(pct, 0.12)).toBe(12);
    expect(fromDisplay(pct, 12)).toBe(0.12);
    expect(toDisplay(secs, 4)).toBe(4);
  });

  it("keeps an existing alpha byte when a native picker returns #rrggbb", () => {
    expect(mergeRgb("#f59e0b33", "#112233")).toBe("#11223333");
    expect(mergeRgb("#f59e0b", "#112233")).toBe("#112233");
  });
});
