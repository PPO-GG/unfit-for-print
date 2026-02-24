// server/utils/game-engine.ts
// Shared game engine utilities for all gameplay server API routes.
// Replaces duplicated code that was copy-pasted across 4 Appwrite Functions.

import { Query, type Databases, TablesDB } from "node-appwrite";

// ─── Game State Encoding ────────────────────────────────────────────

export const encodeGameState = (state: Record<string, any>): string => {
  const serialized = JSON.stringify(state);
  if (serialized.length > 14000) {
    console.warn(
      `[GameEngine] Warning: Encoded game state is dangerously large (${serialized.length} chars). Limit is 16384.`,
    );
  }
  return serialized;
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
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
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
  const tables = getAdminTables();

  // Get total count
  const { total } = await tables.listRows({
    databaseId: dbId,
    tableId: collectionId,
    queries: [Query.limit(1), ...packFilter],
  });

  const ids: string[] = [];
  for (let offset = 0; offset < total; offset += BATCH) {
    const res = await tables.listRows({
      databaseId: dbId,
      tableId: collectionId,
      queries: [Query.limit(BATCH), Query.offset(offset), ...packFilter],
    });
    ids.push(...res.rows.map((d) => d.$id));
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
    scores: state.scores || {},
    round: state.round,
    roundWinner: state.roundWinner,
    winningCards: state.winningCards || null,
    roundEndStartTime: state.roundEndStartTime,
    returnedToLobby: state.returnedToLobby,
    gameEndTime: state.gameEndTime,
    skippedPlayers: state.skippedPlayers || [],
    revealedCards: state.revealedCards || {},
    config: state.config || {
      maxPoints: 10,
      cardsPerPlayer: 7,
      cardPacks: [],
      isPrivate: false,
      lobbyName: "Unnamed Game",
    },
  };
}

// ─── Card Filtering Helper ─────────────────────────────────────────
// Builds a Set of all card IDs currently in use for O(1) exclusion.

export function buildExclusionSet(
  ...sources: (string[] | undefined)[]
): Set<string> {
  const set = new Set<string>();
  for (const source of sources) {
    if (source) {
      for (const id of source) set.add(id);
    }
  }
  return set;
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

export function getAdminTables(): TablesDB {
  const { client } = useAppwriteAdmin();
  return new TablesDB(client);
}
export function getAdminDatabases(): Databases {
  const { databases } = useAppwriteAdmin();
  return databases as unknown as Databases;
}

// ─── Optimistic Concurrency Control ─────────────────────────────────
// Uses Appwrite's $updatedAt as a natural version field.
// Read → mutate → verify version → write. Retry on conflict.

/**
 * Re-reads the lobby and throws a 409 if it has been modified since `capturedUpdatedAt`.
 * Call this RIGHT BEFORE your write operations to minimize the TOCTOU window.
 *
 * @param lobbyId The lobby document ID
 * @param capturedUpdatedAt The `$updatedAt` value captured when the lobby was first read
 */
export async function assertVersionUnchanged(
  lobbyId: string,
  capturedUpdatedAt: string,
): Promise<void> {
  const databases = getAdminDatabases();
  const tables = getAdminTables();
  const { DB, LOBBY } = getCollectionIds();

  const fresh = await tables.getRow({
    databaseId: DB,
    tableId: LOBBY,
    rowId: lobbyId,
  });
  if (fresh.$updatedAt !== capturedUpdatedAt) {
    throw createError({
      statusCode: 409,
      statusMessage: "Game state was modified by another action. Retrying...",
    });
  }
}

/**
 * Wraps an async operation with automatic retry on 409 (version conflict).
 * Use this at the top level of game endpoints to handle concurrent mutations.
 *
 * @param fn The operation to execute (should include read, mutate, version check, and write)
 * @param maxRetries Maximum number of attempts (default: 3)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isConflict = err?.statusCode === 409;
      if (isConflict && attempt < maxRetries) {
        console.warn(
          `[ConcurrencyGuard] Version conflict, retry ${attempt}/${maxRetries}`,
        );
        // Exponential backoff: 50ms, 100ms, 150ms...
        await new Promise((r) => setTimeout(r, 50 * attempt));
        continue;
      }
      throw err;
    }
  }
  // Unreachable, but TypeScript needs it
  throw createError({ statusCode: 500, statusMessage: "Exhausted retries" });
}
