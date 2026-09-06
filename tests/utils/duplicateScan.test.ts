import { describe, it, expect } from "vitest";
import {
  normalizeCardText,
  bigramCount,
  maxPossibleDice,
  diceSimilarity,
  findDuplicateClusters,
} from "~/utils/duplicateScan";

describe("normalizeCardText", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeCardText("  The   AMISH  ")).toBe("the amish");
  });

  it("strips punctuation so trailing periods stop mattering", () => {
    expect(normalizeCardText("Being on fire.")).toBe(
      normalizeCardText("being on fire"),
    );
  });

  it("unifies curly apostrophes with straight ones", () => {
    expect(normalizeCardText("Why can’t I sleep?")).toBe(
      normalizeCardText("Why can't I sleep"),
    );
  });

  it("unifies en and em dashes with plain hyphens", () => {
    expect(normalizeCardText("half—baked")).toBe(
      normalizeCardText("half-baked"),
    );
  });

  it("collapses black-card blanks of any length to one marker", () => {
    expect(normalizeCardText("What is _____?")).toBe(
      normalizeCardText("What is __?"),
    );
  });

  it("does not let blanks merge into neighbouring words", () => {
    expect(normalizeCardText("A _____ B")).toBe("a _ b");
  });

  it("survives null and empty text", () => {
    expect(normalizeCardText(null)).toBe("");
    expect(normalizeCardText(undefined)).toBe("");
    expect(normalizeCardText("")).toBe("");
  });
});

describe("bigramCount", () => {
  it("counts whitespace-stripped bigrams", () => {
    // "ab c" -> "abc" -> ab, bc
    expect(bigramCount("ab c")).toBe(2);
  });

  it("is zero for strings too short to form a bigram", () => {
    expect(bigramCount("a")).toBe(0);
    expect(bigramCount("")).toBe(0);
  });
});

describe("diceSimilarity", () => {
  it("scores identical strings 1", () => {
    expect(diceSimilarity("night vision goggles", "night vision goggles")).toBe(
      1,
    );
  });

  it("scores disjoint strings 0", () => {
    expect(diceSimilarity("wwww", "bbbb")).toBe(0);
  });

  it("scores near-duplicates high", () => {
    expect(diceSimilarity("the amish", "amish")).toBeGreaterThan(0.7);
  });
});

describe("maxPossibleDice", () => {
  it("is 1 when both sides have the same bigram count", () => {
    expect(maxPossibleDice(10, 10)).toBe(1);
  });

  it("is an upper bound that real similarity never exceeds", () => {
    const a = "a very long card about the sheer weight of expectation";
    const b = "short card";
    const bound = maxPossibleDice(bigramCount(a), bigramCount(b));
    expect(diceSimilarity(a, b)).toBeLessThanOrEqual(bound);
  });

  it("is zero when either side has no bigrams", () => {
    expect(maxPossibleDice(0, 10)).toBe(0);
    expect(maxPossibleDice(10, 0)).toBe(0);
  });
});

const white = (
  id: string,
  text: string | null,
  extra: Record<string, unknown> = {},
) => ({ id, text, pack: "base", active: true, ...extra });

describe("findDuplicateClusters", () => {
  it("returns nothing when no cards are alike", () => {
    const clusters = findDuplicateClusters(
      [white("1", "Night vision goggles"), white("2", "A sausage festival")],
      { threshold: 0.7, type: "white" },
    );
    expect(clusters).toEqual([]);
  });

  it("groups a matching pair into one cluster", () => {
    const clusters = findDuplicateClusters(
      [white("1", "Being on fire."), white("2", "being on fire")],
      { threshold: 0.7, type: "white" },
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.cards.map((c) => c.id).sort()).toEqual(["1", "2"]);
  });

  it("merges transitively so three duplicates are one cluster, not three pairs", () => {
    const clusters = findDuplicateClusters(
      [
        white("1", "Being on fire"),
        white("2", "Being on fire."),
        white("3", "being on FIRE!"),
      ],
      { threshold: 0.7, type: "white" },
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.cards).toHaveLength(3);
  });

  it("finds duplicates the old leading-character prefilter dropped", () => {
    // "The Amish" vs "Amish" share no first-two characters at all,
    // which the previous prefilter took as grounds to skip the comparison.
    const clusters = findDuplicateClusters(
      [white("1", "The Amish"), white("2", "Amish")],
      { threshold: 0.7, type: "white" },
    );
    expect(clusters).toHaveLength(1);
  });

  it("agrees with a brute-force scan that skips no pairs", () => {
    const texts = [
      "Being on fire",
      "being on fire.",
      "The Amish",
      "Amish people",
      "Night vision goggles",
      "night-vision goggles!",
      "A sausage festival",
      "Grandma",
      "grandma",
      "An honest cop with nothing left to lose",
    ];
    const cards = texts.map((t, i) => white(String(i), t));
    const threshold = 0.6;

    const brute: string[] = [];
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const sim = diceSimilarity(
          normalizeCardText(cards[i]!.text),
          normalizeCardText(cards[j]!.text),
        );
        if (sim >= threshold) brute.push(`${i}:${j}`);
      }
    }

    const found: string[] = [];
    for (const cluster of findDuplicateClusters(cards, {
      threshold,
      type: "white",
    })) {
      for (const pair of cluster.pairs) {
        const [a, b] = [Number(pair.a), Number(pair.b)].sort((x, y) => x - y);
        found.push(`${a}:${b}`);
      }
    }

    expect(found.sort()).toEqual(brute.sort());
  });

  it("never pairs black cards with different pick counts", () => {
    const clusters = findDuplicateClusters(
      [
        { id: "1", text: "What is _?", pack: "base", active: true, pick: 1 },
        { id: "2", text: "What is _?", pack: "base", active: true, pick: 2 },
      ],
      { threshold: 0.7, type: "black" },
    );
    expect(clusters).toEqual([]);
  });

  it("still pairs black cards that share a pick count", () => {
    const clusters = findDuplicateClusters(
      [
        { id: "1", text: "What is _?", pack: "base", active: true, pick: 2 },
        { id: "2", text: "what is __", pack: "base", active: true, pick: 2 },
      ],
      { threshold: 0.7, type: "black" },
    );
    expect(clusters).toHaveLength(1);
  });

  it("ignores pick entirely for white cards", () => {
    const clusters = findDuplicateClusters(
      [
        white("1", "Being on fire", { pick: 1 }),
        white("2", "being on fire", { pick: 2 }),
      ],
      { threshold: 0.7, type: "white" },
    );
    expect(clusters).toHaveLength(1);
  });

  it("sorts clusters by strongest internal similarity first", () => {
    const clusters = findDuplicateClusters(
      [
        white("1", "The Amish"),
        white("2", "Amish"),
        white("3", "Being on fire"),
        white("4", "being on fire."),
      ],
      { threshold: 0.7, type: "white" },
    );
    expect(clusters).toHaveLength(2);
    expect(clusters[0]!.topSimilarity).toBeGreaterThanOrEqual(
      clusters[1]!.topSimilarity,
    );
    expect(clusters[0]!.cards.map((c) => c.id).sort()).toEqual(["3", "4"]);
  });

  it("reports progress as it walks the card list", () => {
    const seen: number[] = [];
    findDuplicateClusters(
      Array.from({ length: 50 }, (_, i) => white(String(i), `card number ${i}`)),
      { threshold: 0.9, type: "white", onProgress: (p) => seen.push(p) },
    );
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(1);
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...seen)).toBeLessThanOrEqual(1);
  });

  it("handles an empty card list", () => {
    expect(findDuplicateClusters([], { threshold: 0.7, type: "white" })).toEqual(
      [],
    );
  });

  it("skips cards with no usable text instead of throwing", () => {
    const clusters = findDuplicateClusters(
      [white("1", ""), white("2", null), white("3", "a")],
      { threshold: 0.7, type: "white" },
    );
    expect(clusters).toEqual([]);
  });
});

describe("findDuplicateClusters pack scope", () => {
  const packed = (id: string, text: string, pack: string | null) => ({
    id,
    text,
    pack,
    active: true,
  });

  it("pairs across packs by default", () => {
    const clusters = findDuplicateClusters(
      [packed("1", "Being on fire", "base"), packed("2", "being on fire.", "expansion")],
      { threshold: 0.7, type: "white" },
    );
    expect(clusters).toHaveLength(1);
  });

  it("skips cross-pack pairs when scoped to the same pack", () => {
    const clusters = findDuplicateClusters(
      [packed("1", "Being on fire", "base"), packed("2", "being on fire.", "expansion")],
      { threshold: 0.7, type: "white", samePackOnly: true },
    );
    expect(clusters).toEqual([]);
  });

  it("still pairs duplicates inside one pack when scoped", () => {
    const clusters = findDuplicateClusters(
      [packed("1", "Being on fire", "base"), packed("2", "being on fire.", "base")],
      { threshold: 0.7, type: "white", samePackOnly: true },
    );
    expect(clusters).toHaveLength(1);
  });

  it("splits a cross-pack group into per-pack groups when scoped", () => {
    const cards = [
      packed("1", "Being on fire", "base"),
      packed("2", "being on fire.", "base"),
      packed("3", "BEING ON FIRE", "expansion"),
      packed("4", "being on fire!", "expansion"),
    ];

    expect(
      findDuplicateClusters(cards, { threshold: 0.7, type: "white" }),
    ).toHaveLength(1);

    const scoped = findDuplicateClusters(cards, {
      threshold: 0.7,
      type: "white",
      samePackOnly: true,
    });
    expect(scoped).toHaveLength(2);
    expect(scoped.map((c) => c.cards.map((x) => x.id).sort()).sort()).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("treats cards with no pack as their own bucket", () => {
    const clusters = findDuplicateClusters(
      [packed("1", "Being on fire", null), packed("2", "being on fire.", null)],
      { threshold: 0.7, type: "white", samePackOnly: true },
    );
    expect(clusters).toHaveLength(1);
  });

  it("does not match a null pack against a named one", () => {
    const clusters = findDuplicateClusters(
      [packed("1", "Being on fire", null), packed("2", "being on fire.", "base")],
      { threshold: 0.7, type: "white", samePackOnly: true },
    );
    expect(clusters).toEqual([]);
  });

  it("still honours pick alongside the pack scope", () => {
    const clusters = findDuplicateClusters(
      [
        { id: "1", text: "What is _?", pack: "base", active: true, pick: 1 },
        { id: "2", text: "what is __", pack: "base", active: true, pick: 2 },
      ],
      { threshold: 0.7, type: "black", samePackOnly: true },
    );
    expect(clusters).toEqual([]);
  });
});
