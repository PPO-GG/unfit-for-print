import { describe, it, expect } from "vitest";
import {
  clusterKey,
  isPending,
  nextPendingIndex,
  pruneDisabledCards,
  pendingCount,
  defaultDisableSelection,
  keptCards,
  canApplyDecision,
} from "~/utils/duplicateQueue";

const cluster = (ids: string[]) => ({
  cards: ids.map((id) => ({ id, text: id, pack: "base", active: true })),
  pairs: ids
    .slice(1)
    .map((id) => ({ a: ids[0]!, b: id, similarity: 0.9 })),
  topSimilarity: 0.9,
});

describe("clusterKey", () => {
  it("is stable regardless of card order", () => {
    expect(clusterKey(cluster(["a", "b", "c"]))).toBe(
      clusterKey(cluster(["c", "a", "b"])),
    );
  });

  it("differs between different groups", () => {
    expect(clusterKey(cluster(["a", "b"]))).not.toBe(
      clusterKey(cluster(["a", "c"])),
    );
  });
});

describe("isPending", () => {
  it("is true for an unresolved group of two or more", () => {
    expect(isPending(cluster(["a", "b"]), new Set())).toBe(true);
  });

  it("is false once the group is resolved", () => {
    const group = cluster(["a", "b"]);
    expect(isPending(group, new Set([clusterKey(group)]))).toBe(false);
  });

  it("is false for a group pruned down to a single card", () => {
    // Nothing left to compare it against, so there is no decision to make.
    expect(isPending(cluster(["a"]), new Set())).toBe(false);
  });
});

describe("nextPendingIndex", () => {
  const clusters = [cluster(["a", "b"]), cluster(["c", "d"]), cluster(["e", "f"])];

  it("advances to the next pending group", () => {
    expect(nextPendingIndex(clusters, new Set(), 0, 1)).toBe(1);
  });

  it("wraps past the end so the last group can always be skipped", () => {
    // The bug: skipping was disabled at the final index, leaving no way out
    // of the last group once earlier ones had been skipped.
    expect(nextPendingIndex(clusters, new Set(), 2, 1)).toBe(0);
  });

  it("wraps backwards from the first group", () => {
    expect(nextPendingIndex(clusters, new Set(), 0, -1)).toBe(2);
  });

  it("steps over resolved groups", () => {
    const resolved = new Set([clusterKey(clusters[1]!)]);
    expect(nextPendingIndex(clusters, resolved, 0, 1)).toBe(2);
  });

  it("wraps over resolved groups at the end of the list", () => {
    const resolved = new Set([clusterKey(clusters[2]!)]);
    expect(nextPendingIndex(clusters, resolved, 1, 1)).toBe(0);
  });

  it("returns -1 when nothing is left to review", () => {
    const resolved = new Set(clusters.map(clusterKey));
    expect(nextPendingIndex(clusters, resolved, 0, 1)).toBe(-1);
  });

  it("returns -1 rather than pointing back at the only pending group", () => {
    // With one group left, "next" has nowhere to go — the caller shows the
    // finished state instead of pretending navigation happened.
    const resolved = new Set([clusterKey(clusters[0]!), clusterKey(clusters[1]!)]);
    expect(nextPendingIndex(clusters, resolved, 2, 1)).toBe(-1);
  });

  it("finds the first pending group from an out-of-range index", () => {
    expect(nextPendingIndex(clusters, new Set(), -1, 1)).toBe(0);
  });

  it("handles an empty list", () => {
    expect(nextPendingIndex([], new Set(), 0, 1)).toBe(-1);
  });
});

describe("pendingCount", () => {
  it("counts only unresolved multi-card groups", () => {
    const clusters = [cluster(["a", "b"]), cluster(["c", "d"]), cluster(["e"])];
    const resolved = new Set([clusterKey(clusters[0]!)]);
    expect(pendingCount(clusters, resolved)).toBe(1);
  });

  it("is zero for an empty list", () => {
    expect(pendingCount([], new Set())).toBe(0);
  });
});

describe("pruneDisabledCards", () => {
  it("drops disabled cards from other groups", () => {
    const clusters = [cluster(["a", "b"]), cluster(["b", "c", "d"])];
    const pruned = pruneDisabledCards(clusters, new Set(["b"]));
    expect(pruned[1]!.cards.map((c) => c.id)).toEqual(["c", "d"]);
  });

  it("drops pairs that referenced a disabled card", () => {
    const clusters = [cluster(["a", "b", "c"])];
    const pruned = pruneDisabledCards(clusters, new Set(["b"]));
    expect(
      pruned[0]!.pairs.every((p) => p.a !== "b" && p.b !== "b"),
    ).toBe(true);
  });

  it("keeps groups in place so indexes stay stable", () => {
    // Removing entries is what made the counter appear to run backwards.
    const clusters = [cluster(["a", "b"]), cluster(["c", "d"])];
    const pruned = pruneDisabledCards(clusters, new Set(["a", "b"]));
    expect(pruned).toHaveLength(2);
    expect(pruned[1]!.cards.map((c) => c.id)).toEqual(["c", "d"]);
  });

  it("leaves untouched groups alone", () => {
    const clusters = [cluster(["a", "b"])];
    const pruned = pruneDisabledCards(clusters, new Set(["z"]));
    expect(pruned[0]!.cards.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input", () => {
    const clusters = [cluster(["a", "b", "c"])];
    pruneDisabledCards(clusters, new Set(["b"]));
    expect(clusters[0]!.cards.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});

describe("review queue end to end", () => {
  it("never strands the reviewer on the last group", () => {
    // Reproduces the report: skip through every group, then resolve the last.
    const clusters = Array.from({ length: 5 }, (_, i) =>
      cluster([`a${i}`, `b${i}`]),
    );
    const resolved = new Set<string>();

    let index = 0;
    for (let i = 0; i < 4; i++) {
      index = nextPendingIndex(clusters, resolved, index, 1);
      expect(index).toBeGreaterThanOrEqual(0);
    }
    // Sitting on the last group, skipping must still move somewhere.
    expect(index).toBe(4);
    expect(nextPendingIndex(clusters, resolved, index, 1)).toBe(0);

    // Resolving it advances to a still-pending group, not backwards into one
    // already dealt with.
    resolved.add(clusterKey(clusters[4]!));
    const after = nextPendingIndex(clusters, resolved, 4, 1);
    expect(after).toBe(0);
    expect(pendingCount(clusters, resolved)).toBe(4);
  });

  it("reports progress that only ever moves forward", () => {
    const clusters = Array.from({ length: 3 }, (_, i) =>
      cluster([`a${i}`, `b${i}`]),
    );
    const resolved = new Set<string>();
    const counts = [pendingCount(clusters, resolved)];

    for (const group of clusters) {
      resolved.add(clusterKey(group));
      counts.push(pendingCount(clusters, resolved));
    }

    expect(counts).toEqual([3, 2, 1, 0]);
  });
});

describe("defaultDisableSelection", () => {
  it("marks everything except the keeper", () => {
    const group = cluster(["a", "b", "c"]);
    expect([...defaultDisableSelection(group, "a")].sort()).toEqual(["b", "c"]);
  });

  it("marks everything when the keeper is not in the group", () => {
    const group = cluster(["a", "b"]);
    expect([...defaultDisableSelection(group, "zzz")].sort()).toEqual(["a", "b"]);
  });

  it("marks nothing for a single-card group", () => {
    expect([...defaultDisableSelection(cluster(["a"]), "a")]).toEqual([]);
  });
});

describe("keptCards", () => {
  it("returns the cards not marked for disabling", () => {
    const group = cluster(["a", "b", "c"]);
    expect(keptCards(group, new Set(["b"])).map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("returns every card when nothing is marked", () => {
    const group = cluster(["a", "b"]);
    expect(keptCards(group, new Set()).map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("canApplyDecision", () => {
  it("allows keeping one and disabling the rest", () => {
    expect(canApplyDecision(cluster(["a", "b", "c"]), new Set(["b", "c"]))).toBe(
      true,
    );
  });

  it("allows keeping several and disabling one", () => {
    expect(canApplyDecision(cluster(["a", "b", "c", "d"]), new Set(["d"]))).toBe(
      true,
    );
  });

  it("allows keeping everything — the 'not duplicates' pass", () => {
    expect(canApplyDecision(cluster(["a", "b"]), new Set())).toBe(true);
  });

  it("refuses to disable every card in the group", () => {
    // Disabling all copies would take the card out of the game entirely,
    // which is never what resolving a duplicate means.
    expect(canApplyDecision(cluster(["a", "b"]), new Set(["a", "b"]))).toBe(
      false,
    );
  });

  it("ignores marked ids that are not in the group", () => {
    expect(canApplyDecision(cluster(["a", "b"]), new Set(["a", "zzz"]))).toBe(
      true,
    );
  });
});
