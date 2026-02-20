// server/utils/game-engine.ts
// Shared game engine utilities for all gameplay server API routes.
// Replaces duplicated code that was copy-pasted across 4 Appwrite Functions.

import { Query, type Databases } from "node-appwrite";

// ─── Game State Encoding ────────────────────────────────────────────

export const encodeGameState = (state: Record<string, any>): string => {
  try {
    return JSON.stringify(state);
  } catch (error) {
    console.error("[GameEngine] Failed to encode game state:", error);
    return "";
  }
};

export const decodeGameState = (raw: string | null): Record<string, any> => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error("[GameEngine] Failed to decode game state:", error);
    return {};
  }
};

// ─── Shuffle ────────────────────────────────────────────────────────

export const shuffle = <T>(array: T[]): T[] => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// ─── Fetch All Card IDs (batched) ───────────────────────────────────

export async function fetchAllIds(
  collectionId: string,
  databases: Databases,
  dbId: string,
  cardPacks: string[] | null = null,
): Promise<string[]> {
  const BATCH = 100;

  // Build pack filter queries
  const buildPackFilter = () => {
    if (!cardPacks || !Array.isArray(cardPacks) || cardPacks.length === 0)
      return [];
    const packConditions = cardPacks.map((pack) => Query.equal("pack", pack));
    return packConditions.length > 1
      ? [Query.or(packConditions)]
      : packConditions;
  };

  const packFilter = buildPackFilter();

  // Get total count
  const { total } = await databases.listDocuments(dbId, collectionId, [
    Query.limit(1),
    ...packFilter,
  ]);

  const ids: string[] = [];
  for (let offset = 0; offset < total; offset += BATCH) {
    const res = await databases.listDocuments(dbId, collectionId, [
      Query.limit(BATCH),
      Query.offset(offset),
      ...packFilter,
    ]);
    ids.push(...res.documents.map((d) => d.$id));
  }

  return ids;
}

// ─── Player Hand Serialization ──────────────────────────────────────
// Appwrite stores hands as an array of JSON strings: ["{playerId, cards}", ...]

export function parsePlayerHands(
  handsArray: string[],
): Record<string, string[]> {
  const hands: Record<string, string[]> = {};
  if (!Array.isArray(handsArray)) return hands;

  for (const handString of handsArray) {
    try {
      const hand = JSON.parse(handString);
      if (hand.playerId) {
        hands[hand.playerId] = Array.isArray(hand.cards) ? hand.cards : [];
      }
    } catch {
      console.error("[GameEngine] Failed to parse player hand:", handString);
    }
  }
  return hands;
}

export function serializePlayerHands(
  hands: Record<string, string[]>,
): string[] {
  return Object.entries(hands).map(([playerId, cards]) =>
    JSON.stringify({ playerId, cards }),
  );
}

// ─── Core State Extraction ──────────────────────────────────────────
// Extracts only the "public" game state fields (no card data) for the lobby doc.

export function extractCoreState(
  state: Record<string, any>,
): Record<string, any> {
  return {
    phase: state.phase,
    judgeId: state.judgeId,
    blackCard: state.blackCard,
    submissions: state.submissions || {},
    playedCards: state.playedCards || {},
    scores: state.scores || {},
    round: state.round,
    roundWinner: state.roundWinner,
    winningCards: state.winningCards || null,
    roundEndStartTime: state.roundEndStartTime,
    returnedToLobby: state.returnedToLobby,
    gameEndTime: state.gameEndTime,
    config: state.config || {
      maxPoints: 10,
      cardsPerPlayer: 7,
      cardPacks: [],
      isPrivate: false,
      lobbyName: "Unnamed Game",
    },
  };
}

// ─── Collection IDs Helper ──────────────────────────────────────────
// Reads all Appwrite collection IDs from runtime config in one place.

export function getCollectionIds() {
  const config = useRuntimeConfig();
  return {
    DB: config.public.appwriteDatabaseId as string,
    LOBBY: config.public.appwriteLobbyCollectionId as string,
    PLAYER: config.public.appwritePlayerCollectionId as string,
    WHITE_CARDS: config.public.appwriteWhiteCardCollectionId as string,
    BLACK_CARDS: config.public.appwriteBlackCardCollectionId as string,
    GAMECARDS: config.public.appwriteGamecardsCollectionId as string,
    GAMECHAT: config.public.appwriteGamechatCollectionId as string,
    GAMESETTINGS: config.public.appwriteGameSettingsCollectionId as string,
  };
}

// ─── Admin Database Accessor ────────────────────────────────────────
// Returns the admin Databases instance from the nuxt-appwrite module.

export function getAdminDatabases(): Databases {
  const { databases } = useAppwriteAdmin();
  return databases as unknown as Databases;
}
