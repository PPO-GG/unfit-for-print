import { describe, it, expect } from "vitest";
import { decorationRegistry } from "~/utils/decorations";

describe("decorationRegistry", () => {
  it("contains the founder-ring entry", () => {
    const entry = decorationRegistry["founder-ring"];
    expect(entry).toBeDefined();
    expect(entry.name).toBe("Founder's Ring");
    expect(entry.type).toBe("ring");
    expect(entry.rarity).toBe("legendary");
    expect(typeof entry.component).toBe("function");
  });

  it("returns undefined for unknown decoration IDs", () => {
    expect(decorationRegistry["nonexistent"]).toBeUndefined();
  });
});
