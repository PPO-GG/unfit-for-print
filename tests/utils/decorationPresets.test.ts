import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FOUNDER_RING_LAYERS, STARTERS } from "#shared/decorationPresets";
import { normalizeLayers } from "#shared/decorationLayers";

const MIGRATIONS = join(process.cwd(), "server/db/migrations");

describe("FOUNDER_RING_LAYERS", () => {
  it("mirrors FounderRing.vue: glow + ring behind, two sparkle orbits in front", () => {
    expect(FOUNDER_RING_LAYERS.layers.map((l) => [l.type, l.side])).toEqual([
      ["glow", "behind"],
      ["ring", "behind"],
      ["particles", "front"],
      ["particles", "front"],
    ]);
  });

  it("is already normalised", () => {
    expect(normalizeLayers(FOUNDER_RING_LAYERS)).toEqual(FOUNDER_RING_LAYERS);
  });

  it("matches the JSON the migration writes, so the two can't drift", () => {
    const file = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"))
      .find((sql) => sql.includes(`WHERE "id" = 'founder-ring'`));
    expect(file, "no migration seeds founder-ring").toBeDefined();
    const json = /SET "layers" = '(.+?)'::jsonb/s.exec(file!)?.[1];
    expect(JSON.parse(json!)).toEqual(FOUNDER_RING_LAYERS);
  });
});

describe("STARTERS", () => {
  it.each(Object.entries(STARTERS))("%s builds a normalised stack", (_id, starter) => {
    const stack = starter.build();
    expect(normalizeLayers(stack)).toEqual(stack);
  });

  it("builds fresh layer ids every time", () => {
    const a = STARTERS["glow-ring"].build().layers.map((l) => l.id);
    const b = STARTERS["glow-ring"].build().layers.map((l) => l.id);
    expect(a).not.toEqual(b);
  });
});
