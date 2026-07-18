import type { AdminCardPack, AdminCardRow } from "~/types/admin";
import { getAppwrite } from "~/utils/appwrite";
import { Query } from "appwrite";

/**
 * Card & pack library for the Cards admin page — backed by the real
 * Appwrite collections.
 *
 * Shape mapping from Appwrite docs → AdminCardPack/AdminCardRow:
 *
 * - A pack is derived by grouping cards by their `pack` string field.
 *   Both black + white card collections are scanned; counts and plays
 *   are aggregated per pack name.
 * - `enabled` mirrors whether any card in the pack is `active`. Toggling
 *   the pack flips `active` on every card in it.
 * - `plays`/`hot` are not tracked by Appwrite today, so they show "—"
 *   and 0 respectively — see ADMIN_INTEGRATION_STATUS.md for the
 *   planned telemetry pipeline.
 *
 * Kept intentionally small: the legacy /admin/cards/browse page has a
 * richer UX; this composable powers the new mockup-style overview page.
 */
export function useAdminCardLibrary() {
  const { tables } = getAppwrite();
  const config = useRuntimeConfig();

  const DB_ID = config.public.appwriteDatabaseId as string;
  const BLACK_COLLECTION = config.public.appwriteBlackCardCollectionId as string;
  const WHITE_COLLECTION = config.public.appwriteWhiteCardCollectionId as string;

  const packs = ref<AdminCardPack[]>([]);
  const cards = ref<AdminCardRow[]>([]);
  const loading = ref(false);

  /** Chunk fetch helper — walks all rows of a collection. */
  async function fetchAllRows(tableId: string) {
    const all: Record<string, any>[] = [];
    const chunk = 1000;
    let offset = 0;
    // prime with count
    const first = await tables.listRows({
      databaseId: DB_ID,
      tableId,
      queries: [Query.limit(1)],
    });
    const total = first.total;
    while (offset < total) {
      const res = await tables.listRows({
        databaseId: DB_ID,
        tableId,
        queries: [Query.limit(chunk), Query.offset(offset)],
      });
      all.push(...res.rows);
      if (res.rows.length < chunk) break;
      offset += chunk;
    }
    return all;
  }

  function slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function refresh() {
    if (!tables) return;
    loading.value = true;
    try {
      const [blackRows, whiteRows] = await Promise.all([
        fetchAllRows(BLACK_COLLECTION),
        fetchAllRows(WHITE_COLLECTION),
      ]);

      // Aggregate by pack name
      type PackAgg = {
        name: string;
        count: number;
        anyActive: boolean;
        allActive: boolean;
      };
      const byName = new Map<string, PackAgg>();
      const rowList: AdminCardRow[] = [];

      const ingest = (rows: Record<string, any>[], kind: "prompt" | "answer") => {
        for (const doc of rows) {
          const packName: string = doc.pack || "(no pack)";
          const packId = slugify(packName);
          const agg = byName.get(packName) ?? {
            name: packName,
            count: 0,
            anyActive: false,
            allActive: true,
          };
          agg.count++;
          if (doc.active) agg.anyActive = true;
          else agg.allActive = false;
          byName.set(packName, agg);

          rowList.push({
            id: doc.$id,
            kind,
            text: doc.text ?? "",
            picks: kind === "prompt" ? (doc.pick ?? 1) : undefined,
            pack: packId,
            added: doc.$createdAt ? new Date(doc.$createdAt).toISOString().slice(0, 10) : "",
            plays: 0,
            hot: 0,
          });
        }
      };
      ingest(blackRows, "prompt");
      ingest(whiteRows, "answer");

      packs.value = Array.from(byName.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p): AdminCardPack => ({
          id: slugify(p.name),
          name: p.name,
          count: p.count,
          kind: "official",
          enabled: p.anyActive,
          plays: "—",
        }));

      cards.value = rowList;
    } catch (err) {
      console.error("[useAdminCardLibrary] refresh failed:", err);
    } finally {
      loading.value = false;
    }
  }

  function collectionFor(kind: "prompt" | "answer"): string {
    return kind === "prompt" ? BLACK_COLLECTION : WHITE_COLLECTION;
  }

  async function togglePack(id: string) {
    const pack = packs.value.find(p => p.id === id);
    if (!pack) return;
    const setActive = !pack.enabled;
    const packCards = cards.value.filter(c => c.pack === id);
    try {
      await Promise.all(
        packCards.map(c =>
          tables.updateRow({
            databaseId: DB_ID,
            tableId: collectionFor(c.kind),
            rowId: c.id,
            data: { active: setActive },
          }),
        ),
      );
      pack.enabled = setActive;
    } catch (err) {
      console.error("[useAdminCardLibrary] togglePack failed:", err);
    }
  }

  async function saveCard(draft: AdminCardRow) {
    const tableId = collectionFor(draft.kind);
    // Map pack slug back to the original name if we have it
    const knownPack = packs.value.find(p => p.id === draft.pack);
    const packName = knownPack?.name ?? draft.pack;
    const data: Record<string, any> = {
      text: draft.text,
      pack: packName,
      active: true,
    };
    if (draft.kind === "prompt") data.pick = draft.picks ?? 1;

    try {
      const existing = cards.value.find(c => c.id === draft.id);
      if (existing) {
        const updated = await tables.updateRow({
          databaseId: DB_ID,
          tableId,
          rowId: draft.id,
          data,
        });
        const i = cards.value.findIndex(c => c.id === draft.id);
        if (i >= 0) cards.value[i] = { ...draft, id: updated.$id };
      } else {
        const created = await tables.createRow({
          databaseId: DB_ID,
          tableId,
          rowId: "unique()",
          data,
        });
        cards.value.unshift({ ...draft, id: created.$id });
      }
    } catch (err) {
      console.error("[useAdminCardLibrary] saveCard failed:", err);
    }
  }

  if (import.meta.client) {
    refresh();
  }

  return { packs, cards, loading, refresh, togglePack, saveCard };
}
