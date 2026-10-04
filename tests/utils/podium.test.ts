import { describe, it, expect } from "vitest";
import { buildPodium, podiumDisplayOrder } from "~/utils/podium";

const pl = (userId: string, name: string) => ({ $id: `row-${userId}`, userId, name }) as any;
const players = [pl("a", "Mynd"), pl("b", "Maxwell"), pl("c", "Grover"), pl("d", "Leo"), pl("e", "")];

describe("buildPodium", () => {
  it("puts the top three scores on steps and ranks the rest", () => {
    const { steps, rest } = buildPodium(
      [
        { playerId: "c", points: 3 },
        { playerId: "a", points: 10 },
        { playerId: "b", points: 6 },
        { playerId: "d", points: 1 },
      ],
      players,
      "Player",
    );
    expect(steps.map((s) => [s.place, s.entries.map((e) => e.name)])).toEqual([
      [1, ["Mynd"]],
      [2, ["Maxwell"]],
      [3, ["Grover"]],
    ]);
    expect(rest).toEqual([{ playerId: "d", name: "Leo", points: 1, rank: 4 }]);
  });

  it("ties share a step and ranks stay dense (no gaps)", () => {
    const { steps, rest } = buildPodium(
      [
        { playerId: "a", points: 7 },
        { playerId: "b", points: 7 },
        { playerId: "c", points: 4 },
        { playerId: "d", points: 2 },
        { playerId: "e", points: 1 },
      ],
      players,
      "Player",
    );
    expect(steps[0]!.entries.map((e) => e.name)).toEqual(["Maxwell", "Mynd"]); // alphabetical within a tie
    expect(steps[0]!.entries.every((e) => e.rank === 1)).toBe(true);
    expect(steps[1]!.entries[0]!.rank).toBe(2);
    expect(steps[2]!.entries[0]!.rank).toBe(3);
    expect(rest).toEqual([{ playerId: "e", name: "Player", points: 1, rank: 4 }]);
  });

  it("resolves names by userId, then $id, then the fallback", () => {
    const { steps } = buildPodium(
      [{ playerId: "row-b", points: 2 }, { playerId: "zzz", points: 1 }],
      players,
      "Player",
    );
    expect(steps[0]!.entries[0]!.name).toBe("Maxwell");
    expect(steps[1]!.entries[0]!.name).toBe("Player");
  });

  it("handles fewer than three players and an empty board", () => {
    expect(buildPodium([{ playerId: "a", points: 1 }], players, "P").steps).toHaveLength(1);
    expect(buildPodium([], players, "P")).toEqual({ steps: [], rest: [] });
  });
});

describe("podiumDisplayOrder", () => {
  it("arranges 2-1-3 and copes with missing steps", () => {
    const s = (place: 1 | 2 | 3) => ({ place, points: 0, entries: [] });
    expect(podiumDisplayOrder([s(1), s(2), s(3)]).map((x) => x.place)).toEqual([2, 1, 3]);
    expect(podiumDisplayOrder([s(1), s(2)]).map((x) => x.place)).toEqual([2, 1]);
    expect(podiumDisplayOrder([s(1)]).map((x) => x.place)).toEqual([1]);
  });
});
