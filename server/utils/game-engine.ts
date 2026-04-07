// server/utils/game-engine.ts
// Shared server-side utilities for the game start API route.
// The Y.Doc (Teleportal) is the single authority for game state.
// These utilities are only used by start.post.ts for card fetching/shuffling.

import { Query, type Databases, TablesDB } from "node-appwrite";

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
  const activeFilter = Query.equal("active", true);
  const tables = getAdminTables();

  // Get total count
  const { total } = await tables.listRows({
    databaseId: dbId,
    tableId: collectionId,
    queries: [Query.limit(1), activeFilter, ...packFilter],
  });

  const ids: string[] = [];
  for (let offset = 0; offset < total; offset += BATCH) {
    const res = await tables.listRows({
      databaseId: dbId,
      tableId: collectionId,
      queries: [Query.limit(BATCH), Query.offset(offset), activeFilter, ...packFilter],
    });
    ids.push(...res.rows.map((d) => d.$id));
  }

  return ids;
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
    USER_DECORATIONS: config.public.appwriteUserDecorationsCollectionId as string,
    DECORATIONS: config.public.appwriteDecorationsCollectionId as string,
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
