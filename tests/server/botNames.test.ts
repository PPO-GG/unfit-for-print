// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ADJECTIVES,
  ADJECTIVE_PERSONA,
  generateBotName,
  personaForBotName,
  type BotPersona,
} from "~/server/utils/botNames";

describe("ADJECTIVE_PERSONA", () => {
  it("gives every adjective a persona", () => {
    expect(Object.keys(ADJECTIVE_PERSONA).sort()).toEqual([...ADJECTIVES].sort());
    for (const adjective of ADJECTIVES) {
      expect(["dark", "absurd", "crowd"]).toContain(ADJECTIVE_PERSONA[adjective]);
    }
  });

  it("splits the adjectives 12 dark, 16 absurd, 22 crowd", () => {
    const count = (p: BotPersona) =>
      ADJECTIVES.filter((a) => ADJECTIVE_PERSONA[a] === p).length;
    expect([count("dark"), count("absurd"), count("crowd")]).toEqual([12, 16, 22]);
  });
});

describe("personaForBotName", () => {
  it("reads the persona from the name's adjective", () => {
    expect(personaForBotName("GloomyBadger")).toBe("dark");
    expect(personaForBotName("ZanyWaffle")).toBe("absurd");
    expect(personaForBotName("FrostyKitten")).toBe("crowd");
  });

  it("reads the numbered fallback name the same way", () => {
    expect(personaForBotName("GloomyBadger42")).toBe("dark");
  });

  it("treats a name with no known adjective as crowd", () => {
    expect(personaForBotName("Robert")).toBe("crowd");
    expect(personaForBotName("")).toBe("crowd");
  });

  it("matches every adjective to its own persona, not a shorter prefix's", () => {
    for (const adjective of ADJECTIVES) {
      expect(personaForBotName(`${adjective}Llama`)).toBe(ADJECTIVE_PERSONA[adjective]);
    }
  });
});

describe("generateBotName", () => {
  it("gives a new bot a persona the lobby's bots lack", () => {
    for (let i = 0; i < 200; i++) {
      expect(personaForBotName(generateBotName(["GloomyBadger", "ZanyWaffle"]))).toBe(
        "crowd",
      );
    }
  });

  it("draws from every persona once the lobby holds all three", () => {
    const seen = new Set<BotPersona>();
    for (let i = 0; i < 300; i++) {
      seen.add(
        personaForBotName(generateBotName(["GloomyBadger", "ZanyWaffle", "FrostyKitten"])),
      );
    }
    expect(seen.size).toBe(3);
  });

  it("never reuses a name already in the lobby", () => {
    const existing = ["GloomyBadger", "ZanyWaffle", "FrostyKitten"];
    for (let i = 0; i < 200; i++) {
      expect(existing.map((n) => n.toLowerCase())).not.toContain(
        generateBotName(existing).toLowerCase(),
      );
    }
  });
});
