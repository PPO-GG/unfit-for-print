import { describe, it, expect } from "vitest";
import { CARD_TEXT_MAX_LENGTH, validateCardText } from "~~/server/utils/cardText";

const NUL = String.fromCharCode(0);

describe("validateCardText", () => {
  it("returns the trimmed text for an ordinary card", () => {
    expect(validateCardText("  A void where my personality should be.  ")).toEqual({
      ok: true,
      text: "A void where my personality should be.",
    });
  });

  it("rejects an opening tag", () => {
    expect(validateCardText('<img src=x onerror="alert(1)">').ok).toBe(false);
  });

  it("rejects a closing tag", () => {
    expect(validateCardText("bold </b> move").ok).toBe(false);
  });

  it("keeps a lone angle bracket, which is punctuation and not markup", () => {
    expect(validateCardText("I <3 deadlines")).toEqual({
      ok: true,
      text: "I <3 deadlines",
    });
  });

  it("rejects text longer than the form allows", () => {
    expect(validateCardText("x".repeat(CARD_TEXT_MAX_LENGTH + 1)).ok).toBe(false);
  });

  it("accepts text exactly at the limit", () => {
    expect(validateCardText("x".repeat(CARD_TEXT_MAX_LENGTH)).ok).toBe(true);
  });

  it("rejects text that is only whitespace", () => {
    expect(validateCardText("   ").ok).toBe(false);
  });

  it("strips control characters rather than storing them", () => {
    expect(validateCardText(`clean${NUL}text`)).toEqual({ ok: true, text: "cleantext" });
  });
});
