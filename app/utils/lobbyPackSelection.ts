import type { PackTile } from "~/utils/cardPacks";
import { isPackId } from "~/utils/packRef";

/**
 * Cleans a lobby's `settings.cardPacks` against the live roster.
 *
 * Lobbies created before pack ids stored the raw pack *key*, which migration
 * 0012_pack_ids kept in the retired `card_packs.pack` column (exposed as
 * `legacyKey`) while promoting any display name to `name`. A non-id entry maps
 * by `legacyKey` first, then by `name` — the same order the server's
 * `resolvePackRefs(..., { legacyKeys: true })` uses — so the host's next write
 * upgrades the doc in place to the pack the lobby actually chose. Entries that
 * match no live pack (deleted, merged away, or switched off) are dropped,
 * exactly as the drawer's old name-based sanitising did.
 */
export function normalizePackSelection(
  entries: string[],
  roster: { id: string; name: string; legacyKey?: string | null }[],
): { ids: string[]; changed: boolean } {
  const liveIds = new Set(roster.map((p) => p.id));
  const idByName = new Map(roster.map((p) => [p.name, p.id]));
  const idByLegacyKey = new Map<string, string>();
  for (const p of roster) {
    if (p.legacyKey && !idByLegacyKey.has(p.legacyKey)) idByLegacyKey.set(p.legacyKey, p.id);
  }

  const ids: string[] = [];
  for (const entry of entries) {
    const id = isPackId(entry) ? entry : (idByLegacyKey.get(entry) ?? idByName.get(entry));
    if (id && liveIds.has(id) && !ids.includes(id)) ids.push(id);
  }

  const changed = ids.length !== entries.length || ids.some((id, i) => id !== entries[i]);
  return { ids, changed };
}

/**
 * Renders a lobby's `settings.cardPacks` entries as display names.
 *
 * `namesById` comes from the live roster. An id with no roster entry (still
 * loading, or the pack is gone) is not worth showing as a uuid and is
 * dropped; a legacy name entry (pre-migration lobby) is already readable and
 * passes through as-is. Shared by `LobbySettingsSummary.vue` and
 * `GameSettings.vue`'s read-only view so the "what does this id mean"
 * decision lives in exactly one place.
 */
export function packLabelsFor(
  entries: string[],
  namesById: Record<string, string>,
): string[] {
  return entries
    .map((entry) => namesById[entry] ?? (isPackId(entry) ? null : entry))
    .filter((label): label is string => Boolean(label));
}

/** Which slice of the roster the rules editor's pack column is showing. */
export type PackFilter = "all" | "selected" | "default";

/**
 * Pack/answer/prompt totals for a lobby's selection. An empty selection is
 * every pack — that is what game/start deals from (fetchAllIds) — so it is
 * tallied as the whole roster and flagged `all` for the "All packs" label.
 */
export function packTally(
  tiles: PackTile[],
  ids: string[],
): { packs: number; white: number; black: number; all: boolean } {
  const all = ids.length === 0;
  const wanted = new Set(ids);
  const chosen = all ? tiles : tiles.filter((tile) => wanted.has(tile.id));
  return {
    packs: chosen.length,
    white: chosen.reduce((sum, tile) => sum + tile.white, 0),
    black: chosen.reduce((sum, tile) => sum + tile.black, 0),
    all,
  };
}

/** Adapts roster tiles to the `{ id, name, legacyKey }` shape normalizePackSelection reads. */
export function packRoster(tiles: PackTile[]): { id: string; name: string; legacyKey: string | null }[] {
  return tiles.map((tile) => ({ id: tile.id, name: tile.pack, legacyKey: tile.legacyKey ?? null }));
}
