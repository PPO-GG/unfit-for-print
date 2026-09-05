import { describe, it, expect } from "vitest";
import {
  collectVisibleCardIds,
  mergeCardTextKeys,
  withResolvedBlackText,
} from "~/utils/cardTexts";

describe("mergeCardTextKeys", () => {
  it("merges chunked keys in order", () => {
    const merged = mergeCardTextKeys({
      cardTextsChunks: "2",
      cardTexts_0: JSON.stringify({ a: { text: "A", pack: "base" } }),
      cardTexts_1: JSON.stringify({ b: { text: "B", pack: "base" } }),
    });

    expect(merged.a?.text).toBe("A");
    expect(merged.b?.text).toBe("B");
  });

  it("merges the flat key on top of the chunks", () => {
    const merged = mergeCardTextKeys({
      cardTextsChunks: "1",
      cardTexts_0: JSON.stringify({ a: { text: "chunked", pack: "base" } }),
      cardTexts: JSON.stringify({ b: { text: "flat", pack: "base" } }),
    });

    expect(merged.a?.text).toBe("chunked");
    expect(merged.b?.text).toBe("flat");
  });

  it("survives malformed JSON in any key", () => {
    const merged = mergeCardTextKeys({
      cardTextsChunks: "1",
      cardTexts_0: "{not json",
      cardTexts: JSON.stringify({ b: { text: "ok", pack: "base" } }),
    });

    expect(merged.b?.text).toBe("ok");
  });
});

describe("collectVisibleCardIds", () => {
  const state = {
    blackCard: { id: "black-1", text: "?", pick: 1 },
    submissions: { "p1": ["white-9"], "p2": ["white-10", "white-11"] },
    winningCards: ["white-12"],
  } as any;

  it("includes the cards in my own hand", () => {
    const ids = collectVisibleCardIds(null, ["white-1", "white-2"]);
    expect(ids).toContain("white-1");
    expect(ids).toContain("white-2");
  });

  it("includes every submitted card so the judging table can render", () => {
    const ids = collectVisibleCardIds(state, []);
    expect(ids).toContain("white-9");
    expect(ids).toContain("white-10");
    expect(ids).toContain("white-11");
  });

  it("includes the winning cards", () => {
    const ids = collectVisibleCardIds(state, []);
    expect(ids).toContain("white-12");
  });

  it("excludes the black card, which is resolved against the other table", () => {
    const ids = collectVisibleCardIds(state, []);
    expect(ids).not.toContain("black-1");
  });

  it("de-duplicates ids that appear in more than one place", () => {
    const ids = collectVisibleCardIds(state, ["white-9"]);
    expect(ids.filter((id) => id === "white-9")).toHaveLength(1);
  });

  it("returns an empty list before a game has started", () => {
    expect(collectVisibleCardIds(null, [])).toEqual([]);
  });
});

describe("withResolvedBlackText", () => {
  const texts = {
    "black-1": { text: "Why am I sticky?", pack: "Base" },
  } as any;

  it("fills in the black card's text from the resolved map", () => {
    const state = { blackCard: { id: "black-1", pick: 1 } } as any;

    const out = withResolvedBlackText(state, texts);

    expect(out!.blackCard!.text).toBe("Why am I sticky?");
    expect(out!.blackCard!.pick).toBe(1);
  });

  it("keeps a text the doc already carries", () => {
    // Legacy docs embed text, and so does the exhausted-deck sentinel.
    const state = {
      blackCard: { id: "", text: "No eligible cards remain", pick: 1 },
    } as any;

    const out = withResolvedBlackText(state, texts);

    expect(out!.blackCard!.text).toBe("No eligible cards remain");
  });

  it("yields an empty string while the text is still resolving", () => {
    const state = { blackCard: { id: "black-unknown", pick: 1 } } as any;

    const out = withResolvedBlackText(state, texts);

    expect(out!.blackCard!.text).toBe("");
  });

  it("passes through a null state and a null black card", () => {
    expect(withResolvedBlackText(null, texts)).toBeNull();
    const state = { blackCard: null } as any;
    expect(withResolvedBlackText(state, texts)!.blackCard).toBeNull();
  });

  it("does not mutate the state it was given", () => {
    const state = { blackCard: { id: "black-1", pick: 1 } } as any;

    withResolvedBlackText(state, texts);

    expect(state.blackCard.text).toBeUndefined();
  });
});
