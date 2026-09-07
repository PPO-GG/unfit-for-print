/**
 * The admin card manager's view of what packs exist and how many cards are in
 * each — plus which packs are marked default (seeded into every new lobby's
 * pack selection) and which are ticked for bulk actions.
 *
 * `packStats` is a *local mirror* of server-side counts. Every mutation the
 * admin performs adjusts it in place rather than re-fetching, so the sidebar
 * stays responsive. That mirror used to be maintained by hand at eight
 * different call sites, each re-deriving "does this pack still have cards?"
 * slightly differently; the `apply*` helpers below are the single place that
 * logic lives now, which is also what makes it testable.
 *
 * The apply* helpers are pure state adjustments — they never call the server.
 * Pairing them with the matching request is useAdminCardMutations' job.
 */
import { ref, computed } from "vue";
import { useNotifications } from "~/composables/useNotifications";

export interface AdminPackTypeStat {
  total: number;
  active: number;
}

export interface AdminPackStat {
  name: string;
  black: AdminPackTypeStat;
  white: AdminPackTypeStat;
}

export type AdminCardType = "black" | "white";

const NO_PACK = "(no pack)";

export function useAdminPackStats() {
  const { $activityFetch } = useNuxtApp();
  const { notify } = useNotifications();

  const packStats = ref<Record<string, AdminPackStat>>({});
  const loadingPacks = ref(false);
  const packSearchTerm = ref("");

  /** Packs marked as defaults for new lobbies. */
  const defaultPacks = ref<string[]>([]);
  /** Packs ticked for a bulk action. */
  const selectedPacks = ref<string[]>([]);

  const sortedPacks = computed(() => {
    const packs = Object.values(packStats.value).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const term = packSearchTerm.value.trim().toLowerCase();
    if (!term) return packs;
    return packs.filter((p) => p.name.toLowerCase().includes(term));
  });

  // ── Loading ───────────────────────────────────────────────────────────────
  function toStatsMap(
    rows: { pack: string; total: number; active: number }[],
  ): Record<string, AdminPackTypeStat> {
    const stats: Record<string, AdminPackTypeStat> = {};
    for (const row of rows) {
      stats[row.pack] = { total: row.total, active: row.active };
    }
    return stats;
  }

  /** One request covers both card types. */
  const loadPacks = async () => {
    loadingPacks.value = true;
    packStats.value = {};
    try {
      const { white, black } = await $activityFetch<{
        white: { pack: string; total: number; active: number }[];
        black: { pack: string; total: number; active: number }[];
      }>("/api/cards/packs");

      const blackStats = toStatsMap(black);
      const whiteStats = toStatsMap(white);
      const merged: Record<string, AdminPackStat> = {};
      for (const name of new Set([
        ...Object.keys(blackStats),
        ...Object.keys(whiteStats),
      ])) {
        merged[name] = {
          name,
          black: blackStats[name] ?? { total: 0, active: 0 },
          white: whiteStats[name] ?? { total: 0, active: 0 },
        };
      }
      packStats.value = merged;
    } catch (err) {
      console.error("Failed to load packs:", err);
    } finally {
      loadingPacks.value = false;
    }
  };

  const loadDefaultPacks = async () => {
    try {
      const { packs } = await $activityFetch<{ packs: string[] }>(
        "/api/admin/cards/default-packs",
      );
      defaultPacks.value = packs;
    } catch (err) {
      console.error("Failed to load default packs:", err);
    }
  };

  const toggleDefaultPack = async (packName: string) => {
    const isDefault = defaultPacks.value.includes(packName);
    try {
      await $activityFetch("/api/admin/cards/toggle-default-pack", {
        method: "POST",
        body: { pack: packName, isDefault: !isDefault },
      });
      defaultPacks.value = isDefault
        ? defaultPacks.value.filter((p) => p !== packName)
        : [...defaultPacks.value, packName];
    } catch {
      notify({
        title: "Update Failed",
        description: `Could not update default status for "${packName}".`,
        color: "error",
      });
    }
  };

  // ── Bulk selection ────────────────────────────────────────────────────────
  const togglePackSelection = (packName: string) => {
    const idx = selectedPacks.value.indexOf(packName);
    if (idx === -1) selectedPacks.value.push(packName);
    else selectedPacks.value.splice(idx, 1);
  };

  const clearPackSelection = () => {
    selectedPacks.value = [];
  };

  // ── Local stat mirror ─────────────────────────────────────────────────────
  /** Drop a pack from the sidebar and from every list that referenced it. */
  function forgetPack(packName: string) {
    delete packStats.value[packName];
    defaultPacks.value = defaultPacks.value.filter((p) => p !== packName);
    selectedPacks.value = selectedPacks.value.filter((p) => p !== packName);
  }

  /** Forget the pack once neither card type has any cards left in it. */
  function forgetPackIfEmpty(packName: string) {
    const stat = packStats.value[packName];
    if (stat && stat.black.total <= 0 && stat.white.total <= 0) {
      forgetPack(packName);
    }
  }

  /** Ensure a pack has an entry in the mirror, creating an empty one if not. */
  function ensurePack(name: string): AdminPackStat {
    if (!packStats.value[name]) {
      packStats.value[name] = {
        name,
        black: { total: 0, active: 0 },
        white: { total: 0, active: 0 },
      };
    }
    return packStats.value[name]!;
  }

  function applyCardCreated(pack: string | undefined, type: AdminCardType) {
    const name = pack || NO_PACK;
    const stat = ensurePack(name);
    stat[type].total++;
    stat[type].active++;
  }

  function applyCardDeleted(
    pack: string | undefined,
    type: AdminCardType,
    wasActive: boolean,
  ) {
    const name = pack || NO_PACK;
    const stat = packStats.value[name];
    if (!stat) return;
    stat[type].total--;
    if (wasActive) stat[type].active--;
    forgetPackIfEmpty(name);
  }

  function applyCardToggled(
    pack: string | undefined,
    type: AdminCardType,
    nowActive: boolean,
  ) {
    const stat = packStats.value[pack || NO_PACK];
    if (!stat) return;
    stat[type].active += nowActive ? 1 : -1;
  }

  /** A whole pack was activated or deactivated, for one type or both. */
  function applyPackToggled(
    packName: string,
    type: AdminCardType | "all",
    active: boolean,
  ) {
    const stat = packStats.value[packName];
    if (!stat) return;
    const types: AdminCardType[] = type === "all" ? ["black", "white"] : [type];
    for (const t of types) {
      stat[t].active = active ? stat[t].total : 0;
    }
  }

  /** Every card of one type was deleted from a pack. */
  function applyPackTypeCleared(packName: string, type: AdminCardType) {
    const stat = packStats.value[packName];
    if (!stat) return;
    stat[type].total = 0;
    stat[type].active = 0;
    forgetPackIfEmpty(packName);
  }

  /** Cards of one type moved from one pack to another. */
  function applyCardsMoved(
    fromPack: string | undefined,
    toPack: string | undefined,
    type: AdminCardType,
    total: number,
    active: number,
  ) {
    const fromName = fromPack || NO_PACK;
    const toName = toPack || NO_PACK;
    if (fromName === toName || total <= 0) return;

    const source = packStats.value[fromName];
    if (source) {
      source[type].total -= total;
      source[type].active -= active;
    }

    const target = ensurePack(toName);
    target[type].total += total;
    target[type].active += active;

    forgetPackIfEmpty(fromName);
  }

  /** A pack was renamed: its stats, default flag and selection follow it. */
  function applyPackRenamed(oldName: string, newName: string) {
    if (oldName === newName) return;
    const stat = packStats.value[oldName];
    const wasDefault = defaultPacks.value.includes(oldName);
    const wasSelected = selectedPacks.value.includes(oldName);

    if (stat) {
      const target = ensurePack(newName);
      target.black.total += stat.black.total;
      target.black.active += stat.black.active;
      target.white.total += stat.white.total;
      target.white.active += stat.white.active;
    }

    forgetPack(oldName);

    if (wasDefault && !defaultPacks.value.includes(newName)) {
      defaultPacks.value = [...defaultPacks.value, newName];
    }
    if (wasSelected && !selectedPacks.value.includes(newName)) {
      selectedPacks.value = [...selectedPacks.value, newName];
    }
  }

  /**
   * Several packs merged into one. The target's default status is whatever it
   * already was — merging never grants it, matching what the server does.
   */
  function applyPacksMerged(sourceNames: string[], targetName: string) {
    const target = ensurePack(targetName);
    for (const name of sourceNames) {
      if (name === targetName) continue;
      const stat = packStats.value[name];
      if (stat) {
        target.black.total += stat.black.total;
        target.black.active += stat.black.active;
        target.white.total += stat.white.total;
        target.white.active += stat.white.active;
      }
      forgetPack(name);
    }
  }

  function cardCountFor(packName: string): number {
    const stat = packStats.value[packName];
    return stat ? stat.black.total + stat.white.total : 0;
  }

  // ── Presentation ──────────────────────────────────────────────────────────
  const typeStatDotClass = (stat: AdminPackTypeStat) => {
    if (stat.active === 0) return "bg-red-500";
    if (stat.active === stat.total) return "bg-green-400";
    return "bg-yellow-400";
  };

  return {
    packStats,
    loadingPacks,
    packSearchTerm,
    sortedPacks,
    defaultPacks,
    selectedPacks,
    loadPacks,
    loadDefaultPacks,
    toggleDefaultPack,
    togglePackSelection,
    clearPackSelection,
    forgetPack,
    applyCardCreated,
    applyCardDeleted,
    applyCardToggled,
    applyPackToggled,
    applyPackTypeCleared,
    applyCardsMoved,
    applyPackRenamed,
    applyPacksMerged,
    cardCountFor,
    typeStatDotClass,
  };
}

export type AdminPackStats = ReturnType<typeof useAdminPackStats>;
