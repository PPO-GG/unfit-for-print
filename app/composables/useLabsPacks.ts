/**
 * Labs card packs — real Appwrite integration.
 *
 * Lifts the pack-stats + per-pack card loading logic from the admin
 * browser (`app/pages/admin/cards/browse.vue`) so /labs can show the
 * same real pack list + card previews without needing admin perms.
 *
 * Stubs that remain:
 *   - Pack `color` — derived deterministically from the name (hash),
 *     since the underlying schema doesn't store a color.
 *   - Pack `desc` / `vibe` / `rating` / `plays` / `new` / `source` —
 *     we don't track these. `rating` / `plays` render as `null` in
 *     the UI; the pack tile hides those fields.
 *
 * See docs/ui-overhaul-future-features.md → Labs § 4 "Card packs
 * system" for the full wiring plan (new `packs` collection).
 */

import { Query } from "appwrite";
import type { LabsPack, LabsPackCard, SubmissionKind } from "~/types/labs";
import { getAppwrite } from "~/utils/appwrite";

// Deterministic color picker — same hash-to-slot pattern used for
// author avatars in `useLabsSubmissions`, so packs get stable colors
// across sessions without any storage.
const PACK_COLORS = [
  "oklch(78% 0.20 195)",
  "oklch(82% 0.18 95)",
  "oklch(70% 0.20 295)",
  "oklch(72% 0.22 355)",
  "oklch(76% 0.18 320)",
  "oklch(74% 0.20 175)",
  "oklch(78% 0.18 50)",
  "oklch(72% 0.22 25)",
  "oklch(80% 0.20 140)",
  "oklch(70% 0.22 260)",
];
function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PACK_COLORS[hash % PACK_COLORS.length]!;
}

interface PackTypeStat {
  total: number;
  active: number;
}
interface PackStatsRaw {
  name: string;
  black: PackTypeStat;
  white: PackTypeStat;
}

async function loadPackStatsForCollection(
  tables: NonNullable<ReturnType<typeof getAppwrite>["tables"]>,
  dbId: string,
  collectionId: string,
): Promise<Record<string, PackTypeStat>> {
  const stats: Record<string, PackTypeStat> = {};
  const countRes = await tables.listRows({
    databaseId: dbId,
    tableId: collectionId,
    queries: [Query.limit(1)],
  });
  const total = countRes.total;
  const chunkSize = 1000;
  for (let offset = 0; offset < total; offset += chunkSize) {
    const res = await tables.listRows({
      databaseId: dbId,
      tableId: collectionId,
      queries: [Query.limit(chunkSize), Query.offset(offset)],
    });
    for (const doc of res.rows as Array<Record<string, unknown>>) {
      const name = (doc.pack as string | undefined) || "(no pack)";
      if (!stats[name]) stats[name] = { total: 0, active: 0 };
      stats[name]!.total++;
      if (doc.active) stats[name]!.active++;
    }
    if (res.rows.length < chunkSize) break;
  }
  return stats;
}

export function useLabsPacks() {
  const config = useRuntimeConfig();
  const dbId = config.public.appwriteDatabaseId as string;
  const blackId = config.public.appwriteBlackCardCollectionId as string;
  const whiteId = config.public.appwriteWhiteCardCollectionId as string;

  const packs = ref<LabsPack[]>([]);
  const packCards = ref<Record<string, LabsPackCard[]>>({});
  const loading = ref(false);
  const loadingCardsFor = ref<string | null>(null);

  async function loadPacks() {
    if (!import.meta.client) return;
    const { tables } = getAppwrite();
    if (!tables) return;

    loading.value = true;
    try {
      const [blackStats, whiteStats] = await Promise.all([
        loadPackStatsForCollection(tables, dbId, blackId),
        loadPackStatsForCollection(tables, dbId, whiteId),
      ]);

      const allNames = new Set<string>([
        ...Object.keys(blackStats),
        ...Object.keys(whiteStats),
      ]);

      const merged: LabsPack[] = [];
      for (const name of allNames) {
        const black = blackStats[name] ?? { total: 0, active: 0 };
        const white = whiteStats[name] ?? { total: 0, active: 0 };
        merged.push({
          id: slugify(name),
          name,
          color: colorFor(name),
          cards: black.total + white.total,
          white: white.total,
          black: black.total,
          // Fields we don't track yet — render "—" in the UI when null.
          plays: 0,
          rating: 0,
          vibe: "core",
          desc: "",
          official: true,
          new: false,
        });
      }

      merged.sort((a, b) => a.name.localeCompare(b.name));
      packs.value = merged;
    } catch (err) {
      console.error("[labs] loadPacks failed", err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetch a preview of cards for a pack. Pulls up to `limit` cards of
   * each type (black + white), shuffled, cached in `packCards`.
   */
  async function loadPackCards(packName: string, limit = 12) {
    if (!import.meta.client) return;
    if (packCards.value[slugify(packName)]?.length) return;
    const { tables } = getAppwrite();
    if (!tables) return;

    loadingCardsFor.value = slugify(packName);
    try {
      const [blackRes, whiteRes] = await Promise.all([
        tables.listRows({
          databaseId: dbId,
          tableId: blackId,
          queries: [Query.equal("pack", packName), Query.limit(limit)],
        }),
        tables.listRows({
          databaseId: dbId,
          tableId: whiteId,
          queries: [Query.equal("pack", packName), Query.limit(limit)],
        }),
      ]);

      const cards: LabsPackCard[] = [
        ...(blackRes.rows as Array<Record<string, unknown>>).map(
          (row): LabsPackCard => ({
            kind: "prompt" as SubmissionKind,
            text: String(row.text ?? ""),
          }),
        ),
        ...(whiteRes.rows as Array<Record<string, unknown>>).map(
          (row): LabsPackCard => ({
            kind: "answer" as SubmissionKind,
            text: String(row.text ?? ""),
          }),
        ),
      ].sort(() => Math.random() - 0.5);

      packCards.value = {
        ...packCards.value,
        [slugify(packName)]: cards,
      };
    } catch (err) {
      console.error(`[labs] loadPackCards(${packName}) failed`, err);
    } finally {
      loadingCardsFor.value = null;
    }
  }

  return {
    packs,
    packCards,
    loading,
    loadingCardsFor,
    loadPacks,
    loadPackCards,
  };
}

/** Stable, URL-safe slug from a pack's display name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}
