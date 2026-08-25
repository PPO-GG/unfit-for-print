// server/utils/game-engine.ts
// Shared server-side utilities for the game start API route.
// The Y.Doc (Teleportal) is the single authority for game state.
// These utilities are only used by start.post.ts for card fetching/shuffling.

import { and, eq, inArray } from "drizzle-orm";
import { Databases, TablesDB } from "node-appwrite";
import { useDb } from "../db/client";
import type { whiteCards, blackCards } from "../db/schema";

// ─── Shuffle ────────────────────────────────────────────────────────

export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ─── Fetch All Card IDs ──────────────────────────────────────────────

export async function fetchAllIds(
  table: typeof whiteCards | typeof blackCards,
  cardPacks?: string[],
): Promise<string[]> {
  const db = useDb();
  const conditions = [eq(table.active, true)];
  if (cardPacks && cardPacks.length > 0) {
    conditions.push(inArray(table.pack, cardPacks));
  }

  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(and(...conditions));

  return rows.map((r) => r.id);
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
