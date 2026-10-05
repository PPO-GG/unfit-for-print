// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  fillPrompt,
  JUDGE_INSTRUCTIONS,
  playInstructions,
  sampleIndex,
} from "~/server/utils/botChoice";

describe("fillPrompt", () => {
  it("fills a single blank in brackets and drops the card's trailing period", () => {
    expect(fillPrompt("_ is a sure sign of decline.", ["Tweeting."])).toBe(
      "[Tweeting] is a sure sign of decline.",
    );
  });

  it("fills blanks in order", () => {
    expect(fillPrompt("_ + _ = Hipsters", ["Beards.", "Vinyl."])).toBe(
      "[Beards] + [Vinyl] = Hipsters",
    );
  });

  it("collapses a run of underscores into one blank", () => {
    expect(fillPrompt("I want ___ now.", ["Pie."])).toBe("I want [Pie] now.");
  });

  it("leaves unfilled blanks as a single _", () => {
    expect(fillPrompt("_ turned into ___.", ["Coal."])).toBe(
      "[Coal] turned into _.",
    );
  });

  it("returns the bare prompt when there are no fills", () => {
    expect(fillPrompt("_ turned into _.", [])).toBe("_ turned into _.");
  });

  it("appends fills after a prompt with no blanks", () => {
    expect(fillPrompt("Make a haiku.", ["Soup.", "Whales.", "Rifles."])).toBe(
      "Make a haiku. Soup / Whales / Rifles",
    );
  });

  it("appends fills left over once the blanks run out", () => {
    expect(fillPrompt("Why _?", ["Cats.", "Dogs."])).toBe("Why [Cats]? / Dogs");
  });

  it("strips HTML from the prompt and the fills", () => {
    expect(fillPrompt("<i>Behold</i> _.", ["<b>A llama</b>."])).toBe(
      "Behold [A llama].",
    );
  });
});

describe("sampleIndex", () => {
  it("maps the rng onto cumulative weights", () => {
    const probs = [0.2, 0.5, 0.3];
    expect(sampleIndex(probs, () => 0)).toBe(0);
    // Probes sit clear of the 0.2 / 0.7 boundaries: 0.7 - 0.2 - 0.5 is not
    // exactly 0 in floating point.
    expect(sampleIndex(probs, () => 0.19)).toBe(0);
    expect(sampleIndex(probs, () => 0.21)).toBe(1);
    expect(sampleIndex(probs, () => 0.69)).toBe(1);
    expect(sampleIndex(probs, () => 0.71)).toBe(2);
    expect(sampleIndex(probs, () => 0.9999)).toBe(2);
  });

  it("normalises weights that do not sum to 1", () => {
    expect(sampleIndex([2, 2], () => 0.6)).toBe(1);
  });

  it("never picks a zero, negative or non-finite weight", () => {
    const probs = [0, Number.NaN, -1, 0.4, Number.POSITIVE_INFINITY];
    for (const r of [0, 0.5, 0.9999]) {
      expect(sampleIndex(probs, () => r)).toBe(3);
    }
  });

  it("returns null when nothing is pickable", () => {
    expect(sampleIndex([])).toBeNull();
    expect(sampleIndex([0, 0])).toBeNull();
    expect(sampleIndex([Number.NaN])).toBeNull();
  });
});

describe("instructions", () => {
  it("frames a one-card prompt without card numbering", () => {
    expect(playInstructions(1, 1)).not.toMatch(/card 1 of/);
    expect(playInstructions(1, 1)).toMatch(/Cards Against Humanity/);
  });

  it("names which card of a multi-card prompt is being chosen", () => {
    expect(playInstructions(1, 2)).toMatch(/card 1 of 2/);
    expect(playInstructions(1, 2)).toMatch(/shown as _/);
    expect(playInstructions(2, 2)).not.toMatch(/shown as _/);
  });

  it("frames the judge", () => {
    expect(JUDGE_INSTRUCTIONS).toMatch(/judge/);
  });
});
