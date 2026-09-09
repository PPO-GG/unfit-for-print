<script setup lang="ts">
/**
 * The Packs index. Organising, importing and (later) the pack builder live
 * here. Browsing a pack's cards used to navigate to the separate
 * /admin/cards/browse page; now it expands inline as `AdminCardBrowserPanel`,
 * toggled by `?pack=` on this same route, so switching between the grid and
 * a pack's cards is a query change rather than a page load and both views
 * share one set of pack/card composable instances instead of loading pack
 * stats twice.
 *
 * Pack selection exists on this screen only — the browser never selects
 * packs, which is what removed the two-selection-systems confusion.
 */
import { computed, ref, onMounted } from "vue";
import { useAdminPackStats, type AdminPackStat } from "~/composables/useAdminPackStats";
import { useAdminCardList } from "~/composables/useAdminCardList";
import { useAdminCardMutations } from "~/composables/useAdminCardMutations";
import { useConfirm } from "~/composables/useConfirm";
import { commonPackPrefix } from "~/utils/packName";

definePageMeta({ middleware: "admin" });

const route = useRoute();
const router = useRouter();

/** Set from `?pack=`; when present the browser panel replaces the grid. */
const browsingPack = computed(() => (route.query.pack as string) || null);

const packs = useAdminPackStats();
const {
  packStats, sortedPacks, packMeta, defaultPacks, selectedPacks, packSearchTerm,
  loadPacks, loadDefaultPacks, loadPackMeta,
  togglePackSelection, clearPackSelection, toggleDefaultPack,
} = packs;

const list = useAdminCardList();
const mutations = useAdminCardMutations({ list, packs });
const {
  bulkActionLoading, renamePack, mergePacks, bulkTogglePacks, bulkDeletePacks, createCard,
  packExists, renameSummary, mergeSummary,
} = mutations;

const { confirm } = useConfirm();

const showAdd = ref(false);
const mergeTarget = ref("");
const mergeOpen = ref(false);

const allPackNames = computed(() => Object.keys(packStats.value).sort());

// Every selected pack is already a default -> the action unsets; otherwise
// it sets, so a mixed selection defaults to "make them all default" rather
// than "clear the ones that already are".
const allSelectedDefault = computed(
  () =>
    selectedPacks.value.length > 0 &&
    selectedPacks.value.every((name) => defaultPacks.value.includes(name)),
);

const toggleSelectedDefault = async () => {
  const makeDefault = !allSelectedDefault.value;
  const targets = selectedPacks.value.filter(
    (name) => defaultPacks.value.includes(name) !== makeDefault,
  );
  if (!targets.length) return;
  bulkActionLoading.value = true;
  try {
    await Promise.all(targets.map((name) => toggleDefaultPack(name)));
  } finally {
    bulkActionLoading.value = false;
  }
};

const totalCards = computed(() =>
  sortedPacks.value.reduce((n, p) => n + p.black.total + p.white.total, 0),
);

// `sortedPacks` is alphabetical and search-filtered by the composable; this
// re-orders that result rather than replacing it, so the pack search box keeps
// working whichever sort is chosen.
const packSort = ref<"name" | "size" | "default">("name");
const packSortItems = [
  { label: "Name", value: "name" },
  { label: "Size", value: "size" },
  { label: "Defaults first", value: "default" },
];

// Chips narrow the already-loaded set; they never refetch. `sortedPacks` has
// already applied the search box, so this composes on top of it.
type PackChip = "all" | "default" | "official" | "nsfw" | "inactive";
const packChip = ref<PackChip>("all");

const isDark = (p: AdminPackStat) => p.black.active + p.white.active === 0;

function matchesChip(p: AdminPackStat, chip: PackChip): boolean {
  switch (chip) {
    case "default":
      return defaultPacks.value.includes(p.name);
    case "official":
      return Boolean(packMeta.value[p.name]?.official);
    case "nsfw":
      return Boolean(packMeta.value[p.name]?.nsfw);
    case "inactive":
      return isDark(p);
    default:
      return true;
  }
}

// Counts come off the full roster, not the filtered view, so a chip always
// reports how many it would show rather than how many survive the other chip.
const chipCounts = computed(() => {
  const all = Object.values(packStats.value);
  return {
    all: all.length,
    default: all.filter((p) => matchesChip(p, "default")).length,
    official: all.filter((p) => matchesChip(p, "official")).length,
    nsfw: all.filter((p) => matchesChip(p, "nsfw")).length,
    inactive: all.filter((p) => matchesChip(p, "inactive")).length,
  };
});

// 106 of 111 packs share the "Cards Against Humanity:" prefix; the tile shows
// it small so the distinguishing half can take the headline. Derived from the
// full roster rather than the filtered view so the series label does not
// change as you type in the search box.
const seriesPrefix = computed(() =>
  commonPackPrefix(Object.keys(packStats.value)),
);

const orderedPacks = computed(() => {
  const rows = sortedPacks.value.filter((p) => matchesChip(p, packChip.value));
  if (packSort.value === "size") {
    return rows.sort(
      (a, b) => b.black.total + b.white.total - (a.black.total + a.white.total),
    );
  }
  if (packSort.value === "default") {
    return rows.sort(
      (a, b) =>
        Number(defaultPacks.value.includes(b.name)) -
        Number(defaultPacks.value.includes(a.name)),
    );
  }
  return rows;
});

// Same route, query-only — AdminCardBrowserPanel reads `pack`/`type`/`q`/
// `sort` off this same query, so this is a fresh browsing session for `name`.
const openPack = (name: string) => router.push({ query: { pack: name } });

// Cross-pack "Check duplicates" hands the current selection to the scanner
// as a comma-separated scope rather than building a second duplicate-finding
// UI inline — see server/utils and app/pages/admin/cards/duplicates.vue.
const checkDuplicatesForSelected = () =>
  router.push({
    path: "/admin/cards/duplicates",
    query: { packs: selectedPacks.value.join(",") },
  });

/**
 * Renaming a pack onto a name that already exists is a *merge* server-side:
 * the source's `card_packs` row is deleted and its description/default status
 * go with it, with no undo. The inline rename on the tile is not a dialog, so
 * this is the only place that can put renameSummary()'s warning — the "already
 * exists, so this merges" line and the live-lobby caveat — in front of the
 * admin before it happens. A plain rename onto a free name needs no confirm.
 */
const onRename = async (from: string, to: string) => {
  const target = to.trim();
  if (!target || target === from) return;
  if (packExists(target)) {
    const ok = await confirm({
      title: `Merge "${from}" into "${target}"?`,
      message: renameSummary(from, target),
      confirmButtonText: "Merge",
      confirmButtonColor: "warning",
    });
    if (!ok) return;
  }
  await renamePack(from, target);
};

const mergeWarning = computed(() =>
  mergeSummary([...selectedPacks.value], mergeTarget.value),
);

const confirmMerge = async () => {
  if (await mergePacks([...selectedPacks.value], mergeTarget.value)) {
    mergeTarget.value = "";
    mergeOpen.value = false;
  }
};

// A card added to a brand-new pack has no tile yet — reload the pack stats
// so it appears, rather than requiring a manual refresh.
const onAddCard = async (payload: Record<string, unknown>) => {
  if (await createCard(payload)) {
    showAdd.value = false;
    await loadPacks();
  }
};

onMounted(() => Promise.all([loadPacks(), loadDefaultPacks(), loadPackMeta()]));
</script>

<template>
  <div class="h-[100dvh] min-w-[1100px] flex flex-col overflow-hidden">
    <AdminCardBrowserPanel
      v-if="browsingPack"
      :packs="packs"
      :list="list"
      :mutations="mutations"
    />
    <div v-else class="contents">
    <header class="flex items-center gap-2 pl-24 pr-4 py-2.5 border-b border-slate-700/60 bg-slate-900/70">
      <NuxtLink to="/admin" class="text-xs text-slate-400 hover:text-white">Admin</NuxtLink>
      <span class="text-slate-600 text-xs">/</span>
      <span class="text-xs text-white font-medium">Packs</span>
      <span class="text-xs text-slate-500">
        {{ sortedPacks.length }} packs · {{ totalCards.toLocaleString() }} cards
      </span>
      <span class="flex-1" />
      <UInput
        v-model="packSearchTerm"
        placeholder="Search packs…"
        icon="i-solar-magnifer-linear"
        class="w-64"
      />
      <USelectMenu
        v-model="packSort"
        :items="packSortItems"
        value-key="value"
        class="w-40"
      />
      <UButton to="/admin/cards/duplicates" size="xs" variant="soft">Duplicates</UButton>
      <UButton to="/admin/cards/upload" size="xs" variant="soft">Upload pack</UButton>
      <UButton size="xs" color="primary" @click="showAdd = true">Add card</UButton>
    </header>

    <div
      v-if="selectedPacks.length"
      class="flex items-center gap-2 px-4 py-2 border-b border-primary-700/50 bg-primary-950/60"
    >
      <span class="text-xs text-primary-100">{{ selectedPacks.length }} packs selected</span>
      <UPopover v-model:open="mergeOpen">
        <UButton size="xs" color="primary" variant="soft" :loading="bulkActionLoading">
          Merge into…
        </UButton>
        <template #content>
          <div class="p-3 w-64 flex flex-col gap-2">
            <AdminPackPicker
              v-model="mergeTarget"
              :packs="allPackNames"
              :exclude="selectedPacks"
              label="Destination"
            />
            <!-- The popover replaced the merge dialog, so this is where the
                 consequences have to be stated: which pack's settings survive,
                 and that games in progress drop the merged packs. -->
            <p v-if="mergeWarning" data-testid="merge-summary" class="text-[11px] text-amber-300/90">
              {{ mergeWarning }}
            </p>
            <UButton size="xs" color="primary" :disabled="!mergeTarget.trim()" @click="confirmMerge">
              Merge
            </UButton>
          </div>
        </template>
      </UPopover>
      <UButton size="xs" variant="ghost" :loading="bulkActionLoading" @click="toggleSelectedDefault">
        {{ allSelectedDefault ? "Unset default" : "Set as default" }}
      </UButton>
      <UButton size="xs" variant="ghost" :loading="bulkActionLoading" @click="bulkTogglePacks(true)">Activate</UButton>
      <UButton size="xs" variant="ghost" :loading="bulkActionLoading" @click="bulkTogglePacks(false)">Deactivate</UButton>
      <UButton size="xs" variant="ghost" @click="checkDuplicatesForSelected">Check duplicates</UButton>
      <UButton size="xs" color="error" variant="ghost" :loading="bulkActionLoading" @click="bulkDeletePacks">Delete</UButton>
      <span class="flex-1" />
      <UButton size="xs" variant="ghost" @click="clearPackSelection">Clear</UButton>
    </div>

    <div class="flex items-center gap-2 px-4 py-2 border-b border-slate-700/60 bg-slate-900/40">
      <button
        v-for="chip in [
          { id: 'all', label: 'All', n: chipCounts.all },
          { id: 'default', label: 'Default', n: chipCounts.default },
          { id: 'official', label: 'Official', n: chipCounts.official },
          { id: 'nsfw', label: 'NSFW', n: chipCounts.nsfw },
          { id: 'inactive', label: 'Inactive', n: chipCounts.inactive },
        ]"
        :key="chip.id"
        type="button"
        :data-testid="`pack-chip-${chip.id}`"
        :aria-pressed="packChip === chip.id"
        class="rounded-full px-3 py-1 text-xs transition-colors"
        :class="
          packChip === chip.id
            ? 'bg-primary-600 text-white'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        "
        @click="packChip = chip.id as typeof packChip"
      >
        {{ chip.label }}
        <span class="opacity-70 ml-1">{{ chip.n.toLocaleString() }}</span>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <p v-if="!orderedPacks.length" class="text-xs text-slate-500">
        No packs match this filter.
      </p>
      <div class="grid gap-5" style="grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))">
        <AdminPackTile
          v-for="pack in orderedPacks"
          :key="pack.name"
          :pack="pack"
          :meta="packMeta[pack.name] ?? null"
          :series-prefix="seriesPrefix"
          :is-default="defaultPacks.includes(pack.name)"
          :selected="selectedPacks.includes(pack.name)"
          @open="openPack(pack.name)"
          @toggle-select="togglePackSelection(pack.name)"
          @rename="onRename(pack.name, $event)"
        />
      </div>
    </div>
    </div>

    <AdminCardManagerAddModal
      v-model="showAdd"
      :available-packs="allPackNames"
      @add="onAddCard"
    />
  </div>
</template>
