<script setup lang="ts">
/**
 * The card browser: rail | filter bar | grid | inspector, embedded inline in
 * the Packs screen instead of a separate route. Clicking a pack tile used to
 * navigate to `/admin/cards/browse`, a full page swap that reloaded pack
 * stats and lost the grid's scroll/filter state; now `AdminCardIndex` just
 * toggles this panel in based on `route.query.pack`, so it's an in-place
 * swap on the same route and the two views share one set of composable
 * instances (passed down as props) instead of fetching everything twice.
 *
 * The route stays the source of truth for pack/type/search/sort within this
 * panel — see `readRoute`/`pushQuery` — so the back button and deep links
 * still work exactly as they did as a standalone page.
 */
import { computed, ref, watch, onMounted } from "vue";
import { watchDebounced, useMagicKeys, useElementSize } from "@vueuse/core";
import { gridGeometry } from "~/utils/gridGeometry";
import { commonPackPrefix } from "~/utils/packName";
import type { AdminPackStats } from "~/composables/useAdminPackStats";
import type { AdminCardList, AdminCardSort, AdminCard } from "~/composables/useAdminCardList";
import type { AdminCardMutations } from "~/composables/useAdminCardMutations";
import { useCardSearch, type AdminCardFilter } from "~/composables/useCardSearch";

const props = defineProps<{
  packs: AdminPackStats;
  list: AdminCardList;
  mutations: AdminCardMutations;
}>();

const route = useRoute();
const router = useRouter();

const { packStats, sortedPacks, packMeta, applyPackMeta } = props.packs;

const {
  cards, sortedCards, loadingCards, sort,
  selectedCardIds, isCardSelected, toggleCardSelected, selectCardRangeTo,
  selectAllOf, clearCardSelection, fetchCards,
} = props.list;

const {
  bulkActionLoading, moveSelectedCards, toggleCardActive, deleteCard, saveCardEdit, moveCard,
  deactivateSelectedCards, deleteSelectedCards,
} = props.mutations;

const { searchTerm, cardType, selectedPack } = useCardSearch();

// ── Route ⇄ state ───────────────────────────────────────────────────────────
/** The chip row. "inactive" crosses both types, so it is not an AdminCardFilter. */
type BrowseFilter = AdminCardFilter | "inactive";
const BROWSE_FILTERS: BrowseFilter[] = ["all", "white", "black", "inactive"];

/**
 * The chip is **local panel state, not `useCardSearch.cardType`**.
 *
 * Two reasons, and both are bugs this replaced. Writing "all" into that
 * module-level singleton leaked out: /admin/cards/duplicates reads the same
 * ref and sends it as `type` to routes that resolve one table and 400 on
 * "all", so any visit there left that page broken. And driving the *fetch*
 * from the chip meant Black loaded only the black table, so the bar read
 * "White 0" — while the spec's chips are "filters over one loaded result
 * set, so switching between them costs nothing".
 *
 * So: the browser always fetches both tables, and the chip only narrows what
 * is already in memory. Chip clicks change the URL and nothing else.
 */
const typeFilter = ref<BrowseFilter>("all");

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
  typeFilter.value = BROWSE_FILTERS.includes(t as BrowseFilter)
    ? (t as BrowseFilter)
    : "all";
  searchTerm.value = (q.q as string) || "";
  searchInput.value = searchTerm.value;
  sort.value = readSort(q.sort);
}
readRoute();
// Set once, in setup, before the fetch watcher below exists: the browser is a
// cross-type surface, so every fetch merges both tables and the chips filter
// the result. Nothing here ever writes a narrower value back.
cardType.value = "all";
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
// Counts come off the whole loaded set, never the filtered view — that is what
// makes "Black 500 · White 735" true whichever chip is active.
const counts = computed(() => ({
  all: cards.value.length,
  white: cards.value.filter((c) => c.type === "white").length,
  black: cards.value.filter((c) => c.type === "black").length,
  inactive: cards.value.filter((c) => c.active === false).length,
}));

const visible = computed(() => {
  const rows = sortedCards.value;
  if (typeFilter.value === "all") return rows;
  if (typeFilter.value === "inactive") return rows.filter((c) => c.active === false);
  return rows.filter((c) => c.type === typeFilter.value);
});

const allPackNames = computed(() => Object.keys(packStats.value).sort());
// Same derivation as the Packs grid, off the same loaded roster — so the
// per-pack form's autofill (AdminPackForm) suggests the same series a tile
// on the grid would show.
const seriesPrefix = computed(() => commonPackPrefix(Object.keys(packStats.value)));

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

// Shift extends a range; a plain click toggles one card. The range is measured
// over `visible`, not the loaded set, so a chip-hidden card can never end up
// selected by a gesture that never touched it.
const onSelect = (id: string, ev?: MouseEvent) => {
  if (ev?.shiftKey) selectCardRangeTo(id, visible.value.map((c) => c.id));
  else toggleCardSelected(id);
};

// "Select all N" is labelled from the visible set, so it must select the
// visible set — under the Inactive chip it used to read "Select all 12" and
// select every loaded card, with Deactivate one click away and no confirm.
const onSelectAll = () => selectAllOf(visible.value.map((c) => c.id));
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
// /api/admin/cards/edit nulls imageKey/imageFormat/attachment whenever
// `imageFileId` is absent from the body, so a text-only payload silently turns
// an image card into an empty text card. Pass the card's existing image fields
// straight back through. (Editing the image itself is a follow-up; this only
// stops a routine edit destroying it.)
const onSaveCard = async (payload: { text: string; pick?: number }) => {
  const card = inspected.value;
  if (!card) return;
  await saveCardEdit({
    id: card.id,
    type: card.type,
    ...payload,
    imageFileId: card.imageKey ?? undefined,
    imageFormat: card.imageFormat ?? undefined,
    attachment: card.attachment ?? undefined,
  });
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
// A chip change fetches nothing, so it does not go through fetchCards' own
// clearCardSelection — but it does change what is on screen, and a selection
// that outlives the chip would let Deactivate act on cards the admin can no
// longer see. Same invariant fetchCards keeps, enforced on the filter too.
watch(typeFilter, clearCardSelection);

// The only debounce lives here, on the box's own display value, before it
// ever reaches the route/searchTerm/fetch chain above.
watchDebounced(searchInput, () => pushQuery({}), { debounce: 400, maxWait: 900 });

// Pack stats/meta are already loaded by the parent (AdminCardIndex loads them
// before this panel can ever appear) — this only needs its own card fetch.
onMounted(() => fetchCards());
</script>

<template>
  <header
    class="flex items-center gap-2 pl-24 pr-4 py-2.5 border-b border-slate-700/60 bg-slate-900/70"
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
      :pack-meta="packMeta"
      :current="selectedPack"
      @select="onPack"
    />

    <section class="flex-1 flex flex-col min-w-0">
      <AdminCardFilterBar
        :filter="typeFilter"
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
        @select-all="onSelectAll"
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
      :series-prefix="seriesPrefix"
      :pack-cards="cards"
      @save="onSaveCard"
      @move="onInspectorMove"
      @toggle-active="inspected && toggleCardActive(inspected)"
      @delete="onDeleteCard"
      @pack-saved="applyPackMeta"
    />
  </div>
</template>
