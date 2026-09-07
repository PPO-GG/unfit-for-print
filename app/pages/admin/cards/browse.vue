<script setup lang="ts">
/**
 * The card browser: rail | grid | inspector, locked to the viewport.
 *
 * The route is the source of truth for pack/type/search/sort so the back
 * button and deep links work. `min-w-[1100px]` is the whole responsive story —
 * this is a desktop-only surface by decision.
 */
import { computed, ref, watch, onMounted } from "vue";
import { watchDebounced, useMagicKeys, useElementSize } from "@vueuse/core";
import { gridGeometry } from "~/utils/gridGeometry";
import { useAdminPackStats } from "~/composables/useAdminPackStats";
import { useAdminCardList, type AdminCardSort } from "~/composables/useAdminCardList";
import { useAdminCardMutations } from "~/composables/useAdminCardMutations";
import { useCardSearch, type AdminCardFilter } from "~/composables/useCardSearch";
import type { AdminCard } from "~/composables/useAdminCardList";

definePageMeta({ middleware: "admin" });

const route = useRoute();
const router = useRouter();

const packs = useAdminPackStats();
const { packStats, sortedPacks, packMeta, loadPacks, loadDefaultPacks, loadPackMeta, applyPackMeta } = packs;

const list = useAdminCardList();
const {
  cards, sortedCards, loadingCards, sort,
  selectedCardIds, isCardSelected, toggleCardSelected, selectCardRangeTo,
  selectAllLoaded, clearCardSelection, fetchCards,
} = list;

const mutations = useAdminCardMutations({ list, packs });
const {
  bulkActionLoading, moveSelectedCards, toggleCardActive, deleteCard, saveCardEdit, moveCard,
  deactivateSelectedCards, deleteSelectedCards,
} = mutations;

const { searchTerm, cardType, selectedPack } = useCardSearch();

// ── Route ⇄ state ───────────────────────────────────────────────────────────
const inactiveOnly = ref(false);

// The search box's own display value. `searchTerm` (the shared, module-level
// state that actually drives fetchCards) only updates once this round-trips
// through the URL — see the watchDebounced below — so the box can show every
// keystroke without firing a request per keystroke.
const searchInput = ref(searchTerm.value);

const SORTS: AdminCardSort[] = [
  "pack",
  "az",
  "played-desc",
  "played-asc",
  "winrate-desc",
  "skiprate-desc",
];

function readSort(raw: unknown): AdminCardSort {
  return SORTS.includes(raw as AdminCardSort) ? (raw as AdminCardSort) : "pack";
}

function readRoute() {
  const q = route.query;
  selectedPack.value = (q.pack as string) || undefined;
  const t = (q.type as string) || "all";
  inactiveOnly.value = t === "inactive";
  cardType.value = (inactiveOnly.value ? "all" : t) as AdminCardFilter;
  searchTerm.value = (q.q as string) || "";
  searchInput.value = searchTerm.value;
  sort.value = readSort(q.sort);
}
readRoute();
watch(() => route.query, readRoute);

// Every push carries the current (possibly not-yet-debounced) search text as
// `q`, not just whatever the route already has — otherwise clicking a pack
// rail entry mid-type would round-trip through readRoute with the old/blank
// `q` and wipe out what's in the box before its own debounce got a chance to
// push it.
function pushQuery(patch: Record<string, string | undefined>) {
  router.replace({
    query: { ...route.query, q: searchInput.value || undefined, ...patch },
  });
}

// ── Derived ─────────────────────────────────────────────────────────────────
const activeFilter = computed(() => (inactiveOnly.value ? "inactive" : cardType.value));

const counts = computed(() => ({
  all: cards.value.length,
  white: cards.value.filter((c) => c.type === "white").length,
  black: cards.value.filter((c) => c.type === "black").length,
  inactive: cards.value.filter((c) => c.active === false).length,
}));

const visible = computed(() =>
  inactiveOnly.value ? sortedCards.value.filter((c) => c.active === false) : sortedCards.value,
);

const allPackNames = computed(() => Object.keys(packStats.value).sort());

const inspectedId = ref<string | null>(null);
const inspected = computed<AdminCard | null>(
  () => cards.value.find((c) => c.id === inspectedId.value) ?? null,
);

const packColors = computed(() =>
  Object.fromEntries(
    Object.values(packMeta.value)
      .filter((m) => m.color)
      .map((m) => [m.pack, m.color as string]),
  ),
);

// The grid measures itself for windowing; this measures the same box so the
// arrow keys know the column count. Both go through gridGeometry, so they
// cannot disagree.
const gridWrap = ref<HTMLElement | null>(null);
const { width: gridWidth } = useElementSize(gridWrap);

// ── Handlers ────────────────────────────────────────────────────────────────
const onFilter = (f: string) =>
  pushQuery({ type: f === "all" ? undefined : f });
const onSort = (s: AdminCardSort) => pushQuery({ sort: s === "pack" ? undefined : s });
const onPack = (name: string) => pushQuery({ pack: name });

const onSelect = (id: string) => toggleCardSelected(id);
const onInspect = (id: string) => (inspectedId.value = id);

// Selection bar → bulk move over list.selectedCardIds.
const onMove = async (target: string) => {
  if (await moveSelectedCards(target)) inspectedId.value = null;
};
// Inspector → the single card it is showing. AdminCardInspector only renders
// the form (the source of this emit) when selectedCount <= 1, so this must
// never go through the bulk path: with nothing selected that path is a
// no-op, and with one *other* card selected it would move the wrong one.
const onInspectorMove = async (target: string) => {
  if (inspected.value) await moveCard(inspected.value, target);
};
const onSaveCard = async (payload: { text: string; pick?: number }) => {
  if (!inspected.value) return;
  await saveCardEdit({ id: inspected.value.id, type: inspected.value.type, ...payload });
};
// deleteCard resolves void — it reports through notify() — so clear the
// inspection unconditionally rather than testing a return value it never has.
const onDeleteCard = async () => {
  if (!inspected.value) return;
  await deleteCard(inspected.value);
  inspectedId.value = null;
};

// The selection bar's bulk actions have no dedicated bulk-delete route, and
// deactivating leaves cards in place — see useAdminCardMutations for why
// each is shaped the way it is. Both resolve through notify(), so there is
// nothing here to branch on beyond firing them.
const onDeactivateSelected = () => deactivateSelectedCards();
const onDeleteSelected = () => deleteSelectedCards();

// ── Keyboard ────────────────────────────────────────────────────────────────
// Arrow keys walk the inspection through the *visible* order, so it agrees
// with what is on screen after filtering and sorting. Suppressed while a text
// field has focus, or editing a card in the inspector would move the grid.
const { arrowup, arrowdown, arrowleft, arrowright } = useMagicKeys();

function isTyping() {
  const el = document.activeElement;
  return !!el?.closest("input, textarea, [contenteditable='true']");
}

function step(delta: number) {
  if (isTyping() || !visible.value.length) return;
  const i = visible.value.findIndex((c) => c.id === inspectedId.value);
  const next = i === -1 ? 0 : Math.min(visible.value.length - 1, Math.max(0, i + delta));
  inspectedId.value = visible.value[next]!.id;
}

const columns = computed(() => gridGeometry(gridWidth.value).columns);
// useMagicKeys()'s proxy return type indexes as `ComputedRef<boolean> | undefined`
// under this repo's noUncheckedIndexedAccess — the key is always populated at
// runtime, so a non-null assertion is enough to hand watch() a real source.
watch(arrowleft!, (v) => v && step(-1));
watch(arrowright!, (v) => v && step(1));
watch(arrowup!, (v) => v && step(-columns.value));
watch(arrowdown!, (v) => v && step(columns.value));

// ── Fetching ────────────────────────────────────────────────────────────────
// One watch across all three query-driving refs, not three separate ones:
// a pack click while text is still mid-debounce updates `selectedPack` and
// `searchTerm` in the same readRoute() call (see pushQuery above), and Vue
// coalesces multiple sources changing in the same flush into a single job —
// so this fires fetchCards() exactly once per user action instead of racing
// a second, separately-debounced fetch for the search half of the change.
watch([cardType, selectedPack, searchTerm], () => {
  inspectedId.value = null;
  fetchCards();
});
// The only debounce lives here, on the box's own display value, before it
// ever reaches the route/searchTerm/fetch chain above.
watchDebounced(searchInput, () => pushQuery({}), { debounce: 400, maxWait: 900 });

onMounted(async () => {
  await Promise.all([loadPacks(), loadDefaultPacks(), loadPackMeta()]);
  await fetchCards();
});
</script>

<template>
  <div class="h-[100dvh] min-w-[1100px] flex flex-col overflow-hidden">
    <header
      class="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/60 bg-slate-900/70"
    >
      <NuxtLink to="/admin" class="text-xs text-slate-400 hover:text-white">Admin</NuxtLink>
      <span class="text-slate-600 text-xs">/</span>
      <NuxtLink to="/admin/cards" class="text-xs text-slate-400 hover:text-white">Packs</NuxtLink>
      <template v-if="selectedPack">
        <span class="text-slate-600 text-xs">/</span>
        <span class="text-xs text-white font-medium">{{ selectedPack }}</span>
      </template>
      <span class="flex-1" />
      <UButton to="/admin/cards/upload" size="xs" variant="soft">Upload</UButton>
      <UButton to="/admin/cards/duplicates" size="xs" variant="soft">Duplicates</UButton>
    </header>

    <div class="flex-1 flex min-h-0">
      <AdminCardRail
        class="w-56 shrink-0"
        :packs="sortedPacks"
        :current="selectedPack"
        @select="onPack"
      />

      <section class="flex-1 flex flex-col min-w-0">
        <AdminCardFilterBar
          :filter="activeFilter"
          :search="searchInput"
          :sort="sort"
          :counts="counts"
          @update:filter="onFilter"
          @update:search="searchInput = $event"
          @update:sort="onSort"
        />

        <div ref="gridWrap" class="flex-1 min-h-0 p-3">
          <p v-if="loadingCards" class="text-xs text-slate-500">Loading…</p>
          <AdminCardGrid
            v-else
            :cards="visible"
            :selected-ids="selectedCardIds"
            :inspected-id="inspectedId"
            :pack-colors="packColors"
            @select="onSelect"
            @inspect="onInspect"
          />
        </div>

        <AdminCardSelectionBar
          v-if="selectedCardIds.length"
          :count="selectedCardIds.length"
          :total-loaded="visible.length"
          :packs="allPackNames"
          :exclude-pack="selectedPack"
          :loading="bulkActionLoading"
          @move="onMove"
          @deactivate="onDeactivateSelected"
          @delete="onDeleteSelected"
          @select-all="selectAllLoaded"
          @clear="clearCardSelection"
        />
      </section>

      <AdminCardInspector
        class="w-80 shrink-0"
        :card="inspected"
        :selected-count="selectedCardIds.length"
        :packs="allPackNames"
        :pack-name="selectedPack"
        :pack-meta="selectedPack ? (packMeta[selectedPack] ?? null) : null"
        :pack-cards="cards"
        @save="onSaveCard"
        @move="onInspectorMove"
        @toggle-active="inspected && toggleCardActive(inspected)"
        @delete="onDeleteCard"
        @pack-saved="applyPackMeta"
      />
    </div>
  </div>
</template>
