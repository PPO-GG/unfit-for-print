import { isPackId } from "~/utils/packRef";

/**
 * Cleans a lobby's `settings.cardPacks` against the live roster.
 *
 * Lobbies created before pack ids stored pack *names*; this maps those to ids
 * so the host's next write upgrades the doc in place. Entries that match no
 * live pack (deleted, merged away, or switched off) are dropped, exactly as
 * the drawer's old name-based sanitising did.
 */
export function normalizePackSelection(
  entries: string[],
  roster: { id: string; name: string }[],
): { ids: string[]; changed: boolean } {
  const liveIds = new Set(roster.map((p) => p.id));
  const idByName = new Map(roster.map((p) => [p.name, p.id]));

  const ids: string[] = [];
  for (const entry of entries) {
    const id = isPackId(entry) ? entry : idByName.get(entry);
    if (id && liveIds.has(id) && !ids.includes(id)) ids.push(id);
  }

  const changed = ids.length !== entries.length || ids.some((id, i) => id !== entries[i]);
  return { ids, changed };
}
