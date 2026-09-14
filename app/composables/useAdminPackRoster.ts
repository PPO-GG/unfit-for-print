/**
 * The Explorer's pack list, keyed by pack id. The registry (`pack-meta`)
 * decides which packs exist — including packs whose last card was moved
 * away — and `/api/cards/packs` supplies the counts and the legacy key.
 */
import { computed, ref } from "vue";
import type { AdminPack } from "~/types/adminCard";

interface StatRow {
  packId: string;
  pack: string;
  total: number;
  active: number;
}
interface PublicMetaRow {
  id: string;
  legacyKey?: string | null;
}
interface AdminMetaRow {
  id: string;
  pack: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  official: boolean;
  nsfw: boolean;
  series: string | null;
  isDefault: boolean;
}

export function mergeRoster(
  stats: { white: StatRow[]; black: StatRow[]; meta: PublicMetaRow[] },
  adminMeta: AdminMetaRow[],
): AdminPack[] {
  const counts = (rows: StatRow[], id: string) => {
    const row = rows.find((r) => r.packId === id);
    return { total: row?.total ?? 0, active: row?.active ?? 0 };
  };
  const legacy = new Map(stats.meta.map((m) => [m.id, m.legacyKey ?? null]));

  return adminMeta
    .map((m) => ({
      id: m.id,
      name: m.pack,
      series: m.series,
      description: m.description,
      icon: m.icon,
      color: m.color,
      sortOrder: m.sortOrder,
      official: m.official,
      nsfw: m.nsfw,
      isDefault: m.isDefault,
      legacyKey: legacy.get(m.id) ?? null,
      white: counts(stats.white, m.id),
      black: counts(stats.black, m.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function useAdminPackRoster() {
  const { $activityFetch } = useNuxtApp();
  const packs = ref<AdminPack[]>([]);
  const loading = ref(false);

  const byId = computed(() => new Map(packs.value.map((p) => [p.id, p])));

  async function load() {
    loading.value = true;
    try {
      const [stats, meta] = await Promise.all([
        $activityFetch<{ white: StatRow[]; black: StatRow[]; meta: PublicMetaRow[] }>(
          "/api/cards/packs",
        ),
        $activityFetch<{ packs: AdminMetaRow[] }>("/api/admin/cards/pack-meta"),
      ]);
      packs.value = mergeRoster(stats, meta.packs);
    } finally {
      loading.value = false;
    }
  }

  const findByName = (name: string) =>
    packs.value.find((p) => p.legacyKey === name) ?? packs.value.find((p) => p.name === name);

  return { packs, byId, loading, load, findByName };
}

export type AdminPackRoster = ReturnType<typeof useAdminPackRoster>;
