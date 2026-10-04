import type { Player } from "~/types/player";

export interface LeaderboardEntry {
  playerId: string;
  points: number;
}
export interface PodiumEntry {
  playerId: string;
  name: string;
  points: number;
  /** Dense rank: two players tied for first are both 1, the next is 2. */
  rank: number;
}
export interface PodiumStep {
  place: 1 | 2 | 3;
  points: number;
  entries: PodiumEntry[];
}
export interface Podium {
  steps: PodiumStep[];
  rest: PodiumEntry[];
}

function nameFor(players: Player[], id: string, fallback: string): string {
  const p = players.find((pl) => pl.userId === id) ?? players.find((pl) => pl.$id === id);
  return p?.name?.trim() || fallback;
}

/**
 * Final standings as a podium. The three highest distinct scores get a step
 * each (everyone tied on a score shares its step); everyone else is listed
 * below with their dense rank (ties share a rank, the next score is rank + 1).
 */
export function buildPodium(
  leaderboard: LeaderboardEntry[],
  players: Player[],
  fallbackName: string,
): Podium {
  const entries = leaderboard
    .map((e) => ({
      playerId: e.playerId,
      name: nameFor(players, e.playerId, fallbackName),
      points: e.points,
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  const groups: PodiumEntry[][] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last[0]!.points === e.points) {
      last.push({ ...e, rank: last[0]!.rank });
    } else {
      groups.push([{ ...e, rank: groups.length + 1 }]);
    }
  }

  const steps = groups.slice(0, 3).map((g, i) => ({
    place: (i + 1) as 1 | 2 | 3,
    points: g[0]!.points,
    entries: g,
  }));
  return { steps, rest: groups.slice(3).flat() };
}

/** Classic podium arrangement: second, first, third. */
export function podiumDisplayOrder(steps: PodiumStep[]): PodiumStep[] {
  const byPlace = (n: number) => steps.find((s) => s.place === n);
  return [byPlace(2), byPlace(1), byPlace(3)].filter((s): s is PodiumStep => !!s);
}
