import { describe, it, expect } from "vitest";
import { parseExplorerQuery, serializeExplorerQuery } from "~/utils/explorerQuery";

describe("parseExplorerQuery", () => {
  it("reads every field", () => {
    expect(
      parseExplorerQuery({ packs: "a,b,,c", type: "black", q: "why", card: "x1", view: "grid" }),
    ).toEqual({ packs: ["a", "b", "c"], type: "black", q: "why", card: "x1", view: "grid", legacyPack: null });
  });

  it("falls back to defaults for missing or unknown values", () => {
    expect(parseExplorerQuery({ type: "purple", view: "3d" })).toEqual({
      packs: [],
      type: "all",
      q: "",
      card: null,
      view: "table",
      legacyPack: null,
    });
  });

  it("exposes the legacy single-pack name", () => {
    expect(parseExplorerQuery({ pack: "CAH Base Set" }).legacyPack).toBe("CAH Base Set");
  });
});

describe("serializeExplorerQuery", () => {
  it("omits defaults and joins packs", () => {
    expect(
      serializeExplorerQuery({ packs: ["a", "b"], type: "all", q: "", card: null, view: "table" }),
    ).toEqual({ packs: "a,b", type: undefined, q: undefined, card: undefined, view: undefined });
  });
});
