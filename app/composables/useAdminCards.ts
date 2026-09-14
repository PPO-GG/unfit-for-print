/**
 * Cards for the packs selected in the Explorer: both tables, merged, each row
 * tagged with its type (ids are only unique per table). Filtering, search and
 * sorting happen client-side over this set — see utils/cardTableView.ts.
 */
import { ref } from "vue";
import type { AdminCard, AdminCardType } from "~/types/adminCard";
import { useNotifications } from "~/composables/useNotifications";

type ListRow = Omit<AdminCard, "type">;

export function useAdminCards() {
  const { $activityFetch } = useNuxtApp();
  const { notify } = useNotifications();
  const cards = ref<AdminCard[]>([]);
  const loading = ref(false);
  let seq = 0;

  async function fetchType(type: AdminCardType, packIds: string[]) {
    const query: Record<string, string> = { type };
    if (packIds.length) query.packs = packIds.join(",");
    const rows = await $activityFetch<ListRow[]>("/api/admin/cards/list", { query });
    return rows.map((r) => ({ ...r, type }) as AdminCard);
  }

  async function load(packIds: string[]) {
    const mine = ++seq;
    loading.value = true;
    try {
      const [white, black] = await Promise.all([
        fetchType("white", packIds),
        fetchType("black", packIds),
      ]);
      if (mine !== seq) return;
      cards.value = [...white, ...black];
    } catch {
      if (mine === seq) notify({ title: "Could not load cards", color: "error" });
    } finally {
      if (mine === seq) loading.value = false;
    }
  }

  return { cards, loading, load };
}

export type AdminCardsList = ReturnType<typeof useAdminCards>;
