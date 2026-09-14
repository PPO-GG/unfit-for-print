<script setup lang="ts">
/**
 * The Card Explorer: pack list · card table · inspector on one screen.
 *
 * The page owns state and wiring only. Rules live in utils (selection, pack
 * list view, card filtering, URL query), loading in useAdminPackRoster /
 * useAdminCards, writes in useExplorerMutations, and the actions shared by the
 * context menus, selection bars and keyboard in useExplorerActions.
 */
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useLocalStorage, watchDebounced } from "@vueuse/core";
import type { AdminCard, AdminPack } from "~/types/adminCard";
import { useAdminPackRoster } from "~/composables/useAdminPackRoster";
import { useAdminCards } from "~/composables/useAdminCards";
import { useExplorerMutations } from "~/composables/useExplorerMutations";
import { useExplorerActions, type ActionId, type ActionScope } from "~/composables/useExplorerActions";
import { useListSelection } from "~/composables/useListSelection";
import { useConfirm } from "~/composables/useConfirm";
import { useNotifications } from "~/composables/useNotifications";
import { useUiStore } from "~/stores/uiStore";
import { buildPackList, packOrder, packTotal, type PackChip, type PackSort } from "~/utils/packListView";
import { cardCounts, filterCards, sortCards, type CardSort } from "~/utils/cardTableView";
import { parseExplorerQuery, serializeExplorerQuery, type CardFilter, type CardView } from "~/utils/explorerQuery";
import { commonPackPrefix } from "~/utils/packName";
import type { PackDraft } from "~/utils/packDraft";

definePageMeta({ middleware: "admin" });

const route = useRoute();
const router = useRouter();
const { $activityFetch } = useNuxtApp();
const { confirm, isOpen: confirmOpen } = useConfirm();
const { notify } = useNotifications();
const uiStore = useUiStore();

const roster = useAdminPackRoster();
const list = useAdminCards();
const m = useExplorerMutations();

// ── Pack list ──────────────────────────────────────────────────────────────
const packSearch = ref("");
const packChip = ref<PackChip>("all");
const packSort = useLocalStorage<PackSort>("admin-explorer:pack-sort", "name");
const packGrouped = useLocalStorage<boolean>("admin-explorer:pack-grouped", true);

const packRows = computed(() =>
  buildPackList(roster.packs.value, {
    search: packSearch.value,
    chip: packChip.value,
    sort: packSort.value,
    grouped: packGrouped.value,
  }),
);
const visiblePackIds = computed(() => packOrder(packRows.value));
// Pruned against the whole roster, not the filtered list: typing a filter that
// hides a selected pack must not deselect it — that would reload the cards and
// unmount a dirty editor without asking. Cards still prune to what is visible.
const rosterPackIds = computed(() => roster.packs.value.map((p) => p.id));
const packSel = useListSelection(visiblePackIds, { pruneAgainst: rosterPackIds });

const chipCounts = computed(() => {
  const count = (chip: PackChip) =>
    buildPackList(roster.packs.value, { search: "", chip, sort: "name", grouped: false }).length;
  return { all: count("all"), default: count("default"), official: count("official"), nsfw: count("nsfw"), inactive: count("inactive") };
});
const totalCards = computed(() => roster.packs.value.reduce((n, p) => n + packTotal(p), 0));
const packNames = computed(() => roster.packs.value.map((p) => p.name));
const seriesPrefix = computed(() => commonPackPrefix(packNames.value));

// ── Cards ──────────────────────────────────────────────────────────────────
const initialQuery = parseExplorerQuery(route.query);
const cardFilter = ref<CardFilter>(initialQuery.type);
const cardSearch = ref(initialQuery.q);
const cardView = ref<CardView>(initialQuery.view);
const cardSort = ref<CardSort | null>(null);

const visibleCards = computed(() =>
  sortCards(filterCards(list.cards.value, { type: cardFilter.value, q: cardSearch.value }), cardSort.value),
);
const visibleCardIds = computed(() => visibleCards.value.map((c) => c.id));
const cardSel = useListSelection(visibleCardIds);
const counts = computed(() => cardCounts(list.cards.value));

// ── Focus and selection ────────────────────────────────────────────────────
const focus = ref<ActionScope>("pack");
const selectedPacks = computed(() =>
  packSel.selected.value.map((id) => roster.byId.value.get(id)).filter((p): p is AdminPack => Boolean(p)),
);
const selectedCards = computed(() => {
  const byId = new Map(list.cards.value.map((c) => [c.id, c]));
  return cardSel.selected.value.map((id) => byId.get(id)).filter((c): c is AdminCard => Boolean(c));
});

const inspector = ref<{ dirty: boolean; focusText: () => void; focusName: () => void } | null>(null);

// One right-click emits a guarded `click` and then `contextmenu` in the same
// tick. Both await this one in-flight prompt: a second `confirm()` would
// replace the singleton dialog's resolver and leave the first caller hanging.
let pendingGuard: Promise<boolean> | null = null;
function guard(): Promise<boolean> {
  if (!inspector.value?.dirty) return Promise.resolve(true);
  pendingGuard ??= confirm({
    title: "Discard unsaved changes?",
    message: "Your edits to this item haven't been saved.",
    confirmButtonText: "Discard",
    confirmButtonColor: "warning",
    cancelButtonText: "Keep editing",
  }).finally(() => {
    pendingGuard = null;
  });
  return pendingGuard;
}

type Mods = { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean };
async function onPackClick(id: string, mods: Mods) {
  if (!(await guard())) return;
  focus.value = "pack";
  packSel.click(id, mods);
}
async function onAllPacks() {
  if (!(await guard())) return;
  focus.value = "pack";
  packSel.clear();
}
async function onCardClick(id: string, mods: Mods) {
  if (!(await guard())) return;
  focus.value = "card";
  cardSel.click(id, mods);
}
/** A right-click moves focus to its pane — which swaps the inspector's editor. */
async function onContextFocus(scope: ActionScope) {
  if (focus.value === scope) return;
  if (!(await guard())) return;
  focus.value = scope;
}
async function onCardToggle(id: string) {
  if (!(await guard())) return;
  focus.value = "card";
  cardSel.toggle(id);
}
async function onCardOpen(id: string) {
  if (!(await guard())) return;
  focus.value = "card";
  cardSel.set([id]);
  await nextTick();
  inspector.value?.focusText();
}
/** Esc and the selection bars' Clear both unmount the editor, so both ask. */
async function clearSelection(scope: ActionScope) {
  if (!(await guard())) return;
  (scope === "pack" ? packSel : cardSel).clear();
}
function onNarrow(scope: ActionScope, id: string) {
  (scope === "pack" ? packSel : cardSel).set([id]);
}
function onDrop(scope: ActionScope, id: string) {
  (scope === "pack" ? packSel : cardSel).remove(id);
}

// ── URL state ──────────────────────────────────────────────────────────────
const ready = ref(false);
function syncUrl() {
  if (!ready.value) return;
  router.replace({
    query: serializeExplorerQuery({
      packs: packSel.selected.value,
      type: cardFilter.value,
      q: cardSearch.value,
      card: cardSel.selected.value.length === 1 ? cardSel.selected.value[0]! : null,
      view: cardView.value,
    }),
  });
}
watch([() => packSel.selected.value.join(","), () => cardSel.selected.value.join(","), cardFilter, cardView], syncUrl);
watchDebounced(cardSearch, syncUrl, { debounce: 300 });

// ── Loading ────────────────────────────────────────────────────────────────
async function refresh() {
  await roster.load();
  await list.load(packSel.selected.value);
}

watch(
  () => packSel.selected.value.join(","),
  async () => {
    if (!ready.value) return;
    cardSel.clear();
    focus.value = "pack";
    await list.load(packSel.selected.value);
  },
);

onMounted(async () => {
  await roster.load();
  const q = parseExplorerQuery(route.query);
  if (q.legacyPack) {
    const found = roster.findByName(q.legacyPack);
    packSel.set(found ? [found.id] : []);
  } else {
    packSel.set(q.packs.filter((id) => roster.byId.value.has(id)));
  }
  await list.load(packSel.selected.value);
  if (q.card && list.cards.value.some((c) => c.id === q.card)) {
    cardSel.set([q.card]);
    focus.value = "card";
  }
  ready.value = true;
  syncUrl();
});

// ── Mutations ──────────────────────────────────────────────────────────────
// Reload after every write, success or failure: a partly-failed write (a pack
// save whose details landed but whose default toggle threw) must never leave
// the view contradicting the database.
const after = async (ok: boolean) => {
  await refresh();
  return ok;
};
const destination = (name: string) => {
  const existing = roster.packs.value.find((p) => p.name === name);
  return existing ? { packId: existing.id } : { name };
};

const mergeOpen = ref(false);
const moveOpen = ref(false);
const seriesOpen = ref(false);
const addOpen = ref(false);

async function runAction(id: ActionId) {
  const packsNow = selectedPacks.value;
  const cardsNow = selectedCards.value;
  switch (id) {
    case "rename":
      // Only a focus change swaps the editor; renaming from an already-focused
      // pack form keeps its edits, so there is nothing to discard.
      if (focus.value !== "pack" && !(await guard())) return;
      focus.value = "pack";
      await nextTick();
      inspector.value?.focusName();
      return;
    case "merge":
      mergeOpen.value = true;
      return;
    case "enable-packs":
    case "disable-packs":
      await after(await m.setPacksActive(packsNow, id === "enable-packs"));
      return;
    case "toggle-default":
      await after(await m.setPacksDefault(packsNow, !packsNow.every((p) => p.isDefault)));
      return;
    case "set-series":
      seriesOpen.value = true;
      return;
    case "check-duplicates":
      router.push({ path: "/admin/cards/duplicates", query: { packs: packsNow.map((p) => p.name).join(",") } });
      return;
    case "delete-packs":
      if (await after(await m.deletePacks(packsNow))) packSel.clear();
      return;
    case "move":
      moveOpen.value = true;
      return;
    case "enable-cards":
    case "disable-cards":
      await after(await m.setCardsActive(cardsNow, id === "enable-cards"));
      return;
    case "copy-text":
      try {
        await navigator.clipboard.writeText(cardsNow[0]?.text ?? "");
        notify({ title: "Copied", color: "success" });
      } catch {
        notify({ title: "Could not copy", color: "error" });
      }
      return;
    case "delete-cards":
      if (await after(await m.deleteCards(cardsNow))) cardSel.clear();
      return;
  }
}

const actions = useExplorerActions({
  packs: selectedPacks,
  cards: selectedCards,
  focus,
  run: runAction,
  selectAll: async (scope) => {
    if (!(await guard())) return;
    (scope === "pack" ? packSel : cardSel).selectAll();
  },
  clear: clearSelection,
});
// The shortcuts listen on window, so they would also fire behind a dialog:
// Escape closing the Merge dialog would clear the selection, and Delete would
// stack a second confirm on the singleton dialog. Off while anything is open,
// including the app-wide Settings slideover mounted in app.vue.
const pageShortcuts = computed(() =>
  confirmOpen.value || mergeOpen.value || moveOpen.value || seriesOpen.value || addOpen.value || uiStore.showSettings
    ? {}
    : actions.shortcuts.value,
);
defineShortcuts(pageShortcuts);

async function onCardSave(edit: { text: string; pick?: number; pack?: string }) {
  const card = selectedCards.value[0];
  if (!card) return;
  let ok = await m.saveCard(card, { text: edit.text, pick: edit.pick });
  if (ok && edit.pack) ok = await m.moveCards([card], destination(edit.pack));
  await after(ok);
}
async function onCardsApply(changes: { pack?: string; active?: boolean; pick?: number }) {
  const target = selectedCards.value;
  let ok = true;
  if (ok && changes.pack) ok = await m.moveCards(target, destination(changes.pack));
  if (ok && changes.active !== undefined) ok = await m.setCardsActive(target, changes.active);
  if (ok && changes.pick !== undefined) ok = await m.setCardsPick(target, changes.pick);
  await after(ok);
}
async function onPackSave(draft: PackDraft) {
  const pack = selectedPacks.value[0];
  if (pack) await after(await m.savePack(pack, draft));
}
async function onPacksApply(changes: {
  series?: string;
  active?: boolean;
  isDefault?: boolean;
  official?: boolean;
  nsfw?: boolean;
}) {
  const target = selectedPacks.value;
  let ok = true;
  if (ok && typeof changes.series === "string") ok = await m.setPacksSeries(target, changes.series);
  if (ok && typeof changes.active === "boolean") ok = await m.setPacksActive(target, changes.active);
  if (ok && typeof changes.isDefault === "boolean") ok = await m.setPacksDefault(target, changes.isDefault);
  if (ok && typeof changes.official === "boolean") ok = await m.setPacksFlag(target, "official", changes.official);
  if (ok && typeof changes.nsfw === "boolean") ok = await m.setPacksFlag(target, "nsfw", changes.nsfw);
  await after(ok);
}
async function onMergeConfirm(target: AdminPack) {
  const ok = await m.mergePacks(selectedPacks.value, target);
  // Select the target before reloading: the target survives the merge, so the
  // new roster keeps it, whereas reloading first would prune the merged-away
  // sources and briefly load every card for an empty selection.
  if (ok) packSel.set([target.id]);
  await refresh();
}
async function onMoveConfirm(name: string) {
  await after(await m.moveCards(selectedCards.value, destination(name)));
}
async function onSeriesConfirm(series: string) {
  await after(await m.setPacksSeries(selectedPacks.value, series));
}
async function onAddCard(payload: Record<string, unknown>) {
  try {
    await $activityFetch("/api/admin/cards/create", { method: "POST", body: payload });
    addOpen.value = false;
    notify({ title: "Card added", color: "success" });
  } catch {
    notify({ title: "Could not add the card", color: "error" });
  }
  await refresh();
}

const plural = (n: number, w: string) => `${n.toLocaleString()} ${w}${n === 1 ? "" : "s"}`;
const CARD_CHIPS: { id: CardFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "black", label: "Black" },
  { id: "white", label: "White" },
  { id: "inactive", label: "Disabled" },
];
</script>

<template>
  <div class="h-[100dvh] min-w-[1100px] flex flex-col overflow-hidden">
    <header class="flex items-center gap-2 pl-24 pr-4 py-2.5 border-b border-slate-700/60 bg-slate-900/70">
      <NuxtLink to="/admin" class="text-xs text-slate-400 hover:text-white">Admin</NuxtLink>
      <span class="text-slate-600 text-xs">/</span>
      <span class="text-xs text-white font-medium">Cards</span>
      <span class="text-xs text-slate-500">{{ plural(roster.packs.value.length, "pack") }} · {{ plural(totalCards, "card") }}</span>
      <span class="flex-1" />
      <UButton to="/admin/cards/duplicates" size="xs" variant="soft">Duplicates</UButton>
      <UButton to="/admin/cards/upload" size="xs" variant="soft">Upload</UButton>
      <UButton size="xs" color="primary" icon="i-solar-add-circle-linear" @click="addOpen = true">Card</UButton>
    </header>

    <div class="flex-1 flex min-h-0">
      <div class="w-64 shrink-0 flex flex-col min-h-0">
        <AdminPackList
          v-model:search="packSearch"
          v-model:chip="packChip"
          v-model:sort="packSort"
          v-model:grouped="packGrouped"
          class="flex-1 min-h-0"
          :rows="packRows"
          :selected-ids="packSel.selected.value"
          :current-id="focus === 'pack' && selectedPacks.length === 1 ? selectedPacks[0]!.id : null"
          :chip-counts="chipCounts"
          :total-cards="totalCards"
          :menu="actions.packMenu.value"
          @click="onPackClick"
          @all="onAllPacks"
          @contextmenu="onContextFocus('pack')"
        />
        <AdminSelectionBar
          v-if="packSel.selected.value.length"
          :label="`${plural(packSel.selected.value.length, 'pack')} selected`"
          :actions="actions.packBar.value"
          :busy="m.busy.value"
          @run="runAction"
          @clear="clearSelection('pack')"
        />
      </div>

      <section class="flex-1 flex flex-col min-w-0">
        <div class="flex items-center gap-2 px-3 py-2 border-b border-slate-700/60 bg-slate-900/40">
          <button
            v-for="c in CARD_CHIPS"
            :key="c.id"
            type="button"
            :data-testid="`card-chip-${c.id}`"
            :aria-pressed="cardFilter === c.id"
            class="rounded-full px-3 py-1 text-xs"
            :class="cardFilter === c.id ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'"
            @click="cardFilter = c.id"
          >
            {{ c.label }} <span class="opacity-70">{{ counts[c.id].toLocaleString() }}</span>
          </button>
          <span class="flex-1" />
          <UInput v-model="cardSearch" size="sm" icon="i-solar-magnifer-linear" placeholder="Search cards…" class="w-64" />
          <UButton size="xs" variant="ghost" :icon="cardView === 'table' ? 'i-solar-widget-linear' : 'i-solar-list-linear'" @click="cardView = cardView === 'table' ? 'grid' : 'table'">
            {{ cardView === "table" ? "Grid" : "Table" }}
          </UButton>
        </div>

        <div class="flex-1 min-h-0 p-2">
          <AdminCardTable
            v-if="cardView === 'table'"
            v-model:sort="cardSort"
            :cards="visibleCards"
            :selected-ids="cardSel.selected.value"
            :current-id="focus === 'card' && selectedCards.length === 1 ? selectedCards[0]!.id : null"
            :menu="actions.cardMenu.value"
            :loading="list.loading.value"
            @click="onCardClick"
            @toggle="onCardToggle"
            @open="onCardOpen"
            @contextmenu="onContextFocus('card')"
          />
          <AdminCardGrid
            v-else
            :cards="visibleCards"
            :selected-ids="cardSel.selected.value"
            :inspected-id="selectedCards.length === 1 ? selectedCards[0]!.id : null"
            @inspect="(id: string) => onCardClick(id, { ctrlKey: false, metaKey: false, shiftKey: false })"
            @select="(id: string, ev: MouseEvent) => (ev.shiftKey ? onCardClick(id, { ctrlKey: false, metaKey: false, shiftKey: true }) : onCardToggle(id))"
          />
        </div>

        <AdminSelectionBar
          v-if="cardSel.selected.value.length"
          :label="`${plural(cardSel.selected.value.length, 'card')} selected`"
          :actions="actions.cardBar.value"
          :busy="m.busy.value"
          @run="runAction"
          @clear="clearSelection('card')"
        />
      </section>

      <AdminExplorerInspector
        ref="inspector"
        class="w-80 shrink-0"
        :focus="focus"
        :packs="selectedPacks"
        :cards="selectedCards"
        :pack-names="packNames"
        :pack-cards="list.cards.value"
        :series-prefix="seriesPrefix"
        :busy="m.busy.value"
        @card-save="onCardSave"
        @card-toggle-active="runAction(selectedCards[0]?.active === false ? 'enable-cards' : 'disable-cards')"
        @card-delete="runAction('delete-cards')"
        @cards-apply="onCardsApply"
        @cards-delete="runAction('delete-cards')"
        @pack-save="onPackSave"
        @pack-delete="runAction('delete-packs')"
        @packs-apply="onPacksApply"
        @packs-merge="mergeOpen = true"
        @packs-delete="runAction('delete-packs')"
        @narrow="onNarrow"
        @drop="onDrop"
      />
    </div>

    <AdminMergeDialog v-model:open="mergeOpen" :sources="selectedPacks" :packs="roster.packs.value" :summary="m.mergeSummary" @confirm="onMergeConfirm" />
    <AdminMoveDialog v-model:open="moveOpen" :count="selectedCards.length" :pack-names="packNames" @confirm="onMoveConfirm" />
    <AdminSeriesDialog
      v-model:open="seriesOpen"
      :count="selectedPacks.length"
      :initial="selectedPacks.length && selectedPacks.every((p) => p.series === selectedPacks[0]!.series) ? (selectedPacks[0]!.series ?? '') : ''"
      @confirm="onSeriesConfirm"
    />
    <AdminCardManagerAddModal v-model="addOpen" :available-packs="packNames" @add="onAddCard" />
  </div>
</template>
