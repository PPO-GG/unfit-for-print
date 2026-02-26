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
    readAloudText: state.readAloudText || undefined,
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
 * Wraps an async operation with automatic retry on retryable errors.
 * Retries on:
 *   - 409 (version conflict) — up to maxRetries attempts
 *   - 404 (row_not_found)    — up to 2 attempts with longer backoff
 *     (transient Appwrite consistency glitch; the document is known to exist)
 *
 * Use this at the top level of game endpoints to handle concurrent mutations.
 *
 * @param fn The operation to execute (should include read, mutate, version check, and write)
 * @param maxRetries Maximum number of attempts for 409 conflicts (default: 5)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
): Promise<T> {
  const MAX_NOT_FOUND_RETRIES = 2;
  let notFoundRetries = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const statusCode = err?.statusCode ?? err?.code;
      const isConflict = statusCode === 409;
      const isNotFound = statusCode === 404;

      if (isConflict && attempt < maxRetries) {
        console.warn(
          `[ConcurrencyGuard] Version conflict, retry ${attempt}/${maxRetries}`,
        );
        // Jittered exponential backoff: base * 2^attempt + random jitter
        // Prevents thundering-herd when multiple players submit simultaneously
        const baseMs = 50 * Math.pow(2, attempt - 1); // 50, 100, 200, 400, 800
        const jitter = Math.random() * baseMs; // 0–100% of base
        await new Promise((r) => setTimeout(r, baseMs + jitter));
        continue;
      }

      if (isNotFound && notFoundRetries < MAX_NOT_FOUND_RETRIES) {
        notFoundRetries++;
        console.warn(
          `[ConcurrencyGuard] Transient 404 (row_not_found), retry ${notFoundRetries}/${MAX_NOT_FOUND_RETRIES}`,
        );
        // Longer backoff for 404 — Appwrite consistency lag
        const baseMs = 200 * Math.pow(2, notFoundRetries - 1); // 200, 400
        const jitter = Math.random() * 100;
        await new Promise((r) => setTimeout(r, baseMs + jitter));
        continue;
      }

      throw err;
    }
  }
  // Unreachable, but TypeScript needs it
  throw createError({ statusCode: 500, statusMessage: "Exhausted retries" });
}

/**
 * Post-write verification for submission operations.
 * Re-reads the lobby after writing and throws 409 if the expected
 * player's submission is missing — catches lost updates that slip
 * through the TOCTOU gap between assertVersionUnchanged and the write.
 *
 * @param lobbyId The lobby document ID
 * @param playerId The player whose submission should be present
 */
export async function verifySubmission(
  lobbyId: string,
  playerId: string,
): Promise<void> {
  const tables = getAdminTables();
  const { DB, LOBBY } = getCollectionIds();

  const fresh = await tables.getRow({
    databaseId: DB,
    tableId: LOBBY,
    rowId: lobbyId,
  });
  const freshState = decodeGameState(fresh.gameState);
  if (!freshState.submissions?.[playerId]) {
    console.warn(
      `[ConcurrencyGuard] Post-write verification failed: submission for ${playerId} missing. Retrying...`,
    );
    throw createError({
      statusCode: 409,
      statusMessage: "Submission lost due to concurrent write. Retrying...",
    });
  }
}
