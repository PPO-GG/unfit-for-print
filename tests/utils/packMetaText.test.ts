// Pack metadata is typed by hand into the admin form and then rendered by
// five surfaces that all uppercase it in CSS — so a stray double space or a
// SHOUTED series is invisible where it is entered and permanent in the data.
// Two real rows carried exactly those defects before this existed.
import { describe, it, expect } from "vitest";
import { normalizePackText, looksShouted } from "#shared/packMetaText";

describe("normalizePackText", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizePackText("  Base Pack  ")).toBe("Base Pack");
  });

  it("collapses internal runs of whitespace to a single space", () => {
    // The real defect: "Cards Against Humanity  Nasty Bundle" has a double
    // space, which is why the series-prefix derivation never matched it.
    expect(normalizePackText("Cards Against Humanity  Nasty Bundle")).toBe(
      "Cards Against Humanity Nasty Bundle",
    );
  });

  it("collapses tabs and newlines too, not just spaces", () => {
    expect(normalizePackText("Base\tPack\nTwo")).toBe("Base Pack Two");
  });

  it("returns null for a blank value, so clearing a field clears it", () => {
    // The form's existing contract: empty means null, never "", so readers
    // don't have to test for both.
    expect(normalizePackText("   ")).toBeNull();
    expect(normalizePackText("")).toBeNull();
  });

  it("passes null and undefined straight through", () => {
    expect(normalizePackText(null)).toBeNull();
    expect(normalizePackText(undefined)).toBeNull();
  });

  it("leaves casing alone", () => {
    // Normalization is whitespace only. Casing is advisory — `looksShouted`
    // warns, and the admin decides; some pack names really are acronyms.
    expect(normalizePackText("CAH Base Set")).toBe("CAH Base Set");
    expect(normalizePackText("SHOUTING")).toBe("SHOUTING");
  });
});

describe("looksShouted", () => {
  it("flags an all-caps multi-word value", () => {
    expect(looksShouted("CARDS AGAINST HUMANITY")).toBe(true);
  });

  it("does not flag normal title case", () => {
    expect(looksShouted("Cards Against Humanity")).toBe(false);
  });

  it("does not flag a short acronym", () => {
    // "CAH", "NSFW", "AI" are legitimately upper — warning on them would
    // train the admin to ignore the warning.
    expect(looksShouted("CAH")).toBe(false);
    expect(looksShouted("AI")).toBe(false);
  });

  it("does not flag a value with no cased letters at all", () => {
    expect(looksShouted("2000")).toBe(false);
    expect(looksShouted("🎴")).toBe(false);
  });

  it("does not flag a single long word", () => {
    // One word is a name, not a sentence being shouted — "MEGASUPERPACK"
    // may well be the intended styling.
    expect(looksShouted("MEGASUPERPACK")).toBe(false);
  });

  it("flags a long all-caps value even with punctuation", () => {
    expect(looksShouted("CARDS AGAINST HUMANITY: BASE PACK")).toBe(true);
  });

  it("is quiet on empty and nullish input", () => {
    expect(looksShouted("")).toBe(false);
    expect(looksShouted(null)).toBe(false);
    expect(looksShouted(undefined)).toBe(false);
  });
});
