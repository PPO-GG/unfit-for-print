// composables/useLobbyReactive.ts
// Vue reactivity bridge for Y.Doc shared types.
//
// Yjs shared types (Y.Map, Y.Array) don't trigger Vue reactivity on their own.
// This composable observes Yjs changes and exposes reactive refs that update
// automatically when the Y.Doc changes (locally or via remote sync).
//
// ARCHITECTURE NOTE: Values stored as JSON strings in Y.Map are automatically
// parsed into JavaScript objects for the reactive refs. This keeps the Y.Doc
// simple (string values in Y.Map entries) while giving consumers rich typed objects.
//
// Usage:
//   const lobbyDoc = useLobbyDoc()
//   const reactive = useLobbyReactive(lobbyDoc)
//   // reactive.gameState.value.phase === "submitting"
//   // reactive.players.value === { "user123": { name: "Alice", ... } }

import {
  ref,
  computed,
  onUnmounted,
  getCurrentInstance,
  watch,
  type Ref,
} from "vue";
import type { LobbyDocResult } from "~/composables/useLobbyDoc";
import type { GameState, PlayerId, CardId } from "~/types/game";
import type { CardTexts } from "~/types/gamecards";
import type { PlayerPayload } from "~/composables/useLobbyMutations";

// ─── Helper: Observe a Y.Map and expose its contents as a reactive ref ──────

function useYMapReactive<T>(
  lobbyDoc: LobbyDocResult,
  getMap: () => import("yjs").Map<any>,
  parser: (raw: Record<string, any>) => T,
): Ref<T | null> {
  const data = ref<T | null>(null) as Ref<T | null>;
  let unobserve: (() => void) | null = null;

  const setupObserver = () => {
    cleanupObserver();

    if (!lobbyDoc.doc.value) {
      data.value = null;
      return;
    }

    try {
      const ymap = getMap();

      // Initial read
      const snapshot = Object.fromEntries(ymap.entries());
      data.value = parser(snapshot);

      // Observe changes
      const handler = () => {
        const updated = Object.fromEntries(ymap.entries());
        data.value = parser(updated);
      };
      ymap.observe(handler);
      unobserve = () => ymap.unobserve(handler);
    } catch {
      data.value = null;
    }
  };

  const cleanupObserver = () => {
    if (unobserve) {
      try {
        unobserve();
      } catch {
        /* provider may be destroyed */
      }
      unobserve = null;
    }
  };

  // Re-setup observer when the doc ref changes (connect/disconnect)
  watch(() => lobbyDoc.doc.value, setupObserver, { immediate: true });

  if (getCurrentInstance()) {
    onUnmounted(cleanupObserver);
  }

  return data;
}

// ─── Helper: Observe a Y.Array and expose its contents as a reactive ref ────

function useYArrayReactive<T>(
  lobbyDoc: LobbyDocResult,
  getArray: () => import("yjs").Array<string>,
  parser: (item: string) => T,
): Ref<T[]> {
  const data = ref<T[]>([]) as Ref<T[]>;
  let unobserve: (() => void) | null = null;

  const setupObserver = () => {
    cleanupObserver();

    if (!lobbyDoc.doc.value) {
      data.value = [];
      return;
    }

    try {
      const yarray = getArray();

      // Initial read
      data.value = yarray.toArray().map(parser);

      // Observe changes
      const handler = () => {
        data.value = yarray.toArray().map(parser);
      };
      yarray.observe(handler);
      unobserve = () => yarray.unobserve(handler);
    } catch {
      data.value = [];
    }
  };

  const cleanupObserver = () => {
    if (unobserve) {
      try {
        unobserve();
      } catch {
        /* provider may be destroyed */
      }
      unobserve = null;
    }
  };

  watch(() => lobbyDoc.doc.value, setupObserver, { immediate: true });

  if (getCurrentInstance()) {
    onUnmounted(cleanupObserver);
  }

  return data;
}

// ─── JSON Parse Helpers ─────────────────────────────────────────────────────

function safeParseJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ─── Parsers ────────────────────────────────────────────────────────────────

function parseGameState(raw: Record<string, any>): GameState {
  return {
    phase: raw.phase ?? "waiting",
    round: raw.round ?? 0,
    judgeId: raw.judgeId ?? null,
    blackCard: safeParseJson(raw.blackCard, null),
    submissions: safeParseJson(raw.submissions, {}),
    scores: safeParseJson(raw.scores, {}),
    roundWinner: raw.roundWinner ?? undefined,
    winningCards: safeParseJson(raw.winningCards, undefined),
    roundEndStartTime: raw.roundEndStartTime ?? null,
    skippedPlayers: safeParseJson(raw.skippedPlayers, []),
    revealedCards: safeParseJson(raw.revealedCards, {}),
    readAloudText: raw.readAloudText ?? "",
    gameEndTime: raw.gameEndTime ?? undefined,
    returnedToLobby: safeParseJson(raw.returnedToLobby, {}),
    players: safeParseJson(raw.players, {}),
    config: safeParseJson(raw.config, {
      maxPoints: 10,
      cardsPerPlayer: 7,
      cardPacks: [],
      isPrivate: false,
      lobbyName: "",
    }),
    // Card data is in the separate "cards" map, but GameState
    // interface includes these fields — stub them from the cards map
    whiteDeck: [],
    blackDeck: [],
    hands: {},
    discardWhite: [],
    discardBlack: [],
  };
}

interface LobbyMeta {
  code: string;
  hostUserId: string;
  status: "waiting" | "playing" | "complete";
  createdAt: number;
}

function parseMeta(raw: Record<string, any>): LobbyMeta {
  return {
    code: raw.code ?? "",
    hostUserId: raw.hostUserId ?? "",
    status: raw.status ?? "waiting",
    createdAt: raw.createdAt ?? 0,
  };
}

interface LobbySettings {
  maxPoints: number;
  cardsPerPlayer: number;
  cardPacks: string[];
  isPrivate: boolean;
  lobbyName: string;
  roundEndCountdownDuration: number;
}

function parseSettings(raw: Record<string, any>): LobbySettings {
  return {
    maxPoints: raw.maxPoints ?? 10,
    cardsPerPlayer: raw.cardsPerPlayer ?? 7,
    cardPacks: safeParseJson(raw.cardPacks, []),
    isPrivate: raw.isPrivate ?? false,
    lobbyName: raw.lobbyName ?? "",
    roundEndCountdownDuration: raw.roundEndCountdownDuration ?? 5,
  };
}

interface LobbyCards {
  whiteDeck: CardId[];
  blackDeck: CardId[];
  discardWhite: CardId[];
  discardBlack: CardId[];
  cardTexts: CardTexts;
}

function parseCards(raw: Record<string, any>): LobbyCards {
  return {
    whiteDeck: safeParseJson(raw.whiteDeck, []),
    blackDeck: safeParseJson(raw.blackDeck, []),
    discardWhite: safeParseJson(raw.discardWhite, []),
    discardBlack: safeParseJson(raw.discardBlack, []),
    cardTexts: safeParseJson(raw.cardTexts, {}),
  };
}

function parsePlayers(
  raw: Record<string, any>,
): Record<PlayerId, PlayerPayload> {
  const result: Record<PlayerId, PlayerPayload> = {};
  for (const [pid, jsonStr] of Object.entries(raw)) {
    try {
      result[pid] = JSON.parse(jsonStr as string);
    } catch {
      /* skip malformed */
    }
  }
  return result;
}

function parseHands(raw: Record<string, any>): Record<PlayerId, CardId[]> {
  const result: Record<PlayerId, CardId[]> = {};
  for (const [pid, jsonStr] of Object.entries(raw)) {
    try {
      result[pid] = JSON.parse(jsonStr as string);
    } catch {
      /* skip malformed */
    }
  }
  return result;
}

export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
}

function parseChatMessage(raw: string): ChatMessage {
  try {
    return JSON.parse(raw);
  } catch {
    return {
      id: "",
      userId: "system",
      name: "System",
      text: raw,
      timestamp: Date.now(),
      isSystem: true,
    };
  }
}

// ─── Main Composable ────────────────────────────────────────────────────────

export function useLobbyReactive(lobbyDoc: LobbyDocResult) {
  // Observe each Y.Map / Y.Array and expose as typed reactive refs
  const meta = useYMapReactive(lobbyDoc, lobbyDoc.getMeta, parseMeta);
  const settings = useYMapReactive(
    lobbyDoc,
    lobbyDoc.getSettings,
    parseSettings,
  );
  const gameState = useYMapReactive(
    lobbyDoc,
    lobbyDoc.getGameState,
    parseGameState,
  );
  const cards = useYMapReactive(lobbyDoc, lobbyDoc.getCards, parseCards);
  const players = useYMapReactive(lobbyDoc, lobbyDoc.getPlayers, parsePlayers);
  const hands = useYMapReactive(lobbyDoc, lobbyDoc.getHands, parseHands);
  const chat = useYArrayReactive(lobbyDoc, lobbyDoc.getChat, parseChatMessage);

  // ── Derived Computeds (mirror useGameContext interface) ────────────────

  const userStore = useUserStore();

  const myId = computed<PlayerId>(() => userStore.user?.$id ?? "");

  const isWaiting = computed(() => {
    const phase = gameState.value?.phase;
    return !phase || phase === "waiting";
  });

  // "submitting-complete" is a brief 500ms intermediate phase after the last card
  // is submitted but before judging begins. Include it in isSubmitting so components
  // that conditionally render on this flag (e.g., GameTable's v-if) stay mounted
  // during the animation window. Without this, GameTable unmounts briefly, destroying
  // pile card positions and preventing the FLIP animation from capturing "first" rects.
  const isSubmitting = computed(() => {
    const phase = gameState.value?.phase;
    return phase === "submitting" || phase === "submitting-complete";
  });
  const isJudging = computed(() => gameState.value?.phase === "judging");
  const isRoundEnd = computed(() => gameState.value?.phase === "roundEnd");
  const isComplete = computed(() => gameState.value?.phase === "complete");

  const isPlaying = computed(() => {
    const phase = gameState.value?.phase;
    return (
      phase === "submitting" ||
      phase === "submitting-complete" ||
      phase === "judging" ||
      phase === "roundEnd"
    );
  });

  const isJudge = computed(() => myId.value === gameState.value?.judgeId);

  const isHost = computed(() => myId.value === meta.value?.hostUserId);

  const myHand = computed<CardId[]>(() => {
    if (!myId.value) return [];
    return hands.value?.[myId.value] ?? [];
  });

  const mySubmission = computed<CardId[] | null>(() => {
    if (!myId.value) return null;
    return gameState.value?.submissions?.[myId.value] ?? null;
  });

  const leaderboard = computed(() => {
    const scores = gameState.value?.scores ?? {};
    return Object.entries(scores)
      .map(([pid, points]) => ({ playerId: pid, points }))
      .sort((a, b) => b.points - a.points);
  });

  const playerList = computed<import("~/types/player").Player[]>(() => {
    if (!players.value) return [];
    return Object.entries(players.value).map(([pid, p]) => ({
      $id: pid, // Use the userId as the id in this model
      userId: p.userId,
      lobbyId: meta.value?.code ?? "",
      name: p.name,
      avatar: p.avatar,
      isHost: p.isHost,
      joinedAt: p.joinedAt,
      provider: p.provider,
      playerType: p.playerType,
    }));
  });

  const cardTexts = computed<CardTexts>(() => cards.value?.cardTexts ?? {});

  return {
    // Raw Y.Doc reactive state
    meta,
    settings,
    gameState,
    cards,
    hands,
    players,
    chat,

    // Derived computeds (compatible with useGameContext interface)
    myId,
    myHand,
    mySubmission,
    isWaiting,
    isSubmitting,
    isJudging,
    isRoundEnd,
    isComplete,
    isPlaying,
    isJudge,
    isHost,
    leaderboard,
    playerList,
    cardTexts,
  };
}
