import type { UnifiedLobby } from "~/server/utils/mergeLobbies";

type Teleportal = NonNullable<UnifiedLobby["teleportal"]>;

export function liveLobby(
  code: string,
  over: Partial<Teleportal> = {},
  lobbyOver: Partial<UnifiedLobby> = {},
): UnifiedLobby {
  return {
    code,
    hasLiveDoc: true,
    hasRegistry: true,
    source: "web",
    teleportal: {
      docId: `lobby/lobby-${code}`,
      clients: 3,
      idleSec: 5,
      phase: "submitting",
      round: 2,
      players: [
        { id: "u1", name: "Mo", playerType: "player" },
        { id: "u2", name: "Jess", playerType: "player" },
        { id: "u3", name: "Kim", playerType: "player" },
      ],
      meta: {},
      lobbyName: "Friday",
      isPrivate: false,
      hostUserId: "u1",
      judgeId: "u1",
      scores: { u1: 1, u2: 3, u3: 0 },
      maxPoints: 7,
      submittedIds: ["u2"],
      onlinePlayerIds: ["u1", "u2", "u3"],
      anonymousClients: 0,
      ...over,
    },
    registry: {
      lobbyId: `id-${code}`,
      status: "playing",
      lobbyName: null,
      hostUserId: "u1",
      createdAt: "2026-10-13T11:00:00.000Z",
      isPrivate: false,
    },
    ...lobbyOver,
  };
}
