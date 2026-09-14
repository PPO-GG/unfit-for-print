// server/utils/game-engine.ts
// Shared server-side utilities for the game start API route.
// The Y.Doc (Teleportal) is the single authority for game state.
// These utilities are only used by start.post.ts for card fetching/shuffling.

import { and, eq, inArray } from "drizzle-orm";
import { useDb } from "../db/client";
import type { whiteCards, blackCards } from "../db/schema";
import { resolvePackRefs } from "./packs";

// ─── Shuffle ────────────────────────────────────────────────────────

export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
  return array;
}

// ─── Fetch All Card IDs ──────────────────────────────────────────────

/**
 * Active card ids, optionally limited to `cardPacks`. Those refs are pack ids,
 * or raw pack keys from a lobby created before migration 0012_pack_ids — both
 * resolve here (`legacyKeys`), so a game in flight across that deploy keeps
 * drawing even from a pack whose display name became its `name`.
 *
 * No refs means every pack (unchanged). Refs that all fail to resolve — every
 * selected pack deleted or merged away — mean no cards, never every card.
 */
export async function fetchAllIds(
  table: typeof whiteCards | typeof blackCards,
  cardPacks?: string[],
): Promise<string[]> {
  const db = useDb();
  const conditions = [eq(table.active, true)];
  if (cardPacks && cardPacks.length > 0) {
    const packIds = await resolvePackRefs(db, cardPacks, { legacyKeys: true });
    if (packIds.length === 0) return [];
    conditions.push(inArray(table.packId, packIds));
  }

  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(and(...conditions));

  return rows.map((r) => r.id);
}
