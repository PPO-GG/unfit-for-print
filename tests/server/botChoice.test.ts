// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  fillPrompt,
  judgeInstructions,
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

  it("leaves no angle brackets behind from nested or broken tags", () => {
    const out = fillPrompt("<<script>script>Why _?", ["<<b>b>Cats."]);
    expect(out).not.toMatch(/[<>]/);
    expect(out).toBe("scriptWhy [bCats]?");
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

const HOUSE =
  "This is a round of Cards Against Humanity, an adult party game where dark, absurd, and offensive humor wins.";
const FAVOR =
  "Favor answers that are surprising, clever, or shockingly fitting for the prompt over answers that are bland or don't fit.";

describe("instructions", () => {
  it("keeps the crowd-pleaser's wording exactly as it shipped", () => {
    expect(playInstructions(1, 1)).toBe(
      `${HOUSE} Which completed card would make a group of friends laugh hardest? ${FAVOR}`,
    );
    expect(playInstructions(1, 2, "crowd")).toBe(
      `${HOUSE} The prompt takes 2 cards and you are choosing card 1 of 2. Cards still to be chosen are shown as _. Which choice makes the funniest card, or sets up the funniest finish? ${FAVOR}`,
    );
    expect(judgeInstructions()).toBe(
      `${HOUSE} You are the judge. Which submitted card would make a group of friends laugh hardest? ${FAVOR}`,
    );
  });

  it("asks a dark bot for the darkest card that still answers the prompt", () => {
    expect(playInstructions(1, 1, "dark")).toBe(
      `${HOUSE} Which completed card is the darkest and most shocking — the one that makes people gasp before they laugh — while still answering the prompt?`,
    );
  });

  it("asks an absurd bot for the most absurd card that still answers the prompt", () => {
    expect(playInstructions(1, 1, "absurd")).toBe(
      `${HOUSE} Which completed card is the most absurd and surreal — the funniest pure nonsense — while still answering the prompt?`,
    );
  });

  it("keeps the multi-card framing for every persona", () => {
    for (const persona of ["dark", "absurd"] as const) {
      expect(playInstructions(1, 2, persona)).toMatch(/card 1 of 2\. Cards still to be chosen are shown as _\./);
      expect(playInstructions(2, 2, persona)).not.toMatch(/shown as _/);
    }
  });

  it("judges with the bot's own taste", () => {
    expect(judgeInstructions("dark")).toBe(
      `${HOUSE} You are the judge. Which submitted card is the darkest and most shocking — the one that makes people gasp before they laugh — while still answering the prompt?`,
    );
    expect(judgeInstructions("absurd")).toBe(
      `${HOUSE} You are the judge. Which submitted card is the most absurd and surreal — the funniest pure nonsense — while still answering the prompt?`,
    );
  });
});
