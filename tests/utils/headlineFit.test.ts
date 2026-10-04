import { describe, it, expect } from "vitest";
import { wordWidth, fitWidth, LONG_WORD } from "~/utils/headlineFit";

describe("headlineFit", () => {
  it("counts an ordinary letter as one average character", () => {
    expect(wordWidth(["M", "a", "x"])).toBeGreaterThan(3);
    expect(wordWidth(["L", "E", "O"])).toBe(3);
  });

  // The title's font-size assumes 0.78em per character; Archivo Black's M and W
  // are about 1em, so a name made of them overflowed at the computed size.
  it("counts wide capitals and emoji as wider than average", () => {
    expect(wordWidth(["M", "M", "M", "M"])).toBeGreaterThanOrEqual(5);
    expect(wordWidth(["W"])).toBeGreaterThan(1.2);
    expect(wordWidth(["👍🏽"])).toBeGreaterThan(1.2);
  });

  it("is case-blind (the headline is uppercased)", () => {
    expect(wordWidth(["m", "w"])).toBe(wordWidth(["M", "W"]));
  });

  // Words longer than LONG_WORD may break mid-word, so sizing for more than
  // that only shrank the whole headline (13.7px for a 32-letter name).
  it("caps the fitting width at LONG_WORD", () => {
    expect(fitWidth([Array(32).fill("A")])).toBe(LONG_WORD);
    expect(fitWidth([["H", "I"], Array(6).fill("A")])).toBe(6);
    expect(fitWidth([])).toBe(1);
  });
});
