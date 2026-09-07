<script setup lang="ts">
/**
 * The Packs index. Organising, importing and (later) the pack builder live
 * here; browsing cards lives at /admin/cards/browse.
 *
 * Pack selection exists on this screen only — the browser never selects
 * packs, which is what removed the two-selection-systems confusion.
 */
import { computed, ref, onMounted } from "vue";
import { useAdminPackStats } from "~/composables/useAdminPackStats";
import { useAdminCardList } from "~/composables/useAdminCardList";
import { useAdminCardMutations } from "~/composables/useAdminCardMutations";
import { useConfirm } from "~/composables/useConfirm";

definePageMeta({ middleware: "admin" });

const router = useRouter();

const packs = useAdminPackStats();
const {
  packStats, sortedPacks, packMeta, defaultPacks, selectedPacks,
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

const orderedPacks = computed(() => {
  const rows = [...sortedPacks.value];
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

const openPack = (name: string) =>
  router.push({ path: "/admin/cards/browse", query: { pack: name } });

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
    <header class="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/60 bg-slate-900/70">
      <NuxtLink to="/admin" class="text-xs text-slate-400 hover:text-white">Admin</NuxtLink>
      <span class="text-slate-600 text-xs">/</span>
      <span class="text-xs text-white font-medium">Packs</span>
      <span class="text-xs text-slate-500">
        {{ sortedPacks.length }} packs · {{ totalCards.toLocaleString() }} cards
      </span>
      <span class="flex-1" />
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
      <UButton size="xs" color="error" variant="ghost" :loading="bulkActionLoading" @click="bulkDeletePacks">Delete</UButton>
      <span class="flex-1" />
      <UButton size="xs" variant="ghost" @click="clearPackSelection">Clear</UButton>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <div class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(230px, 1fr))">
        <AdminPackTile
          v-for="pack in orderedPacks"
          :key="pack.name"
          :pack="pack"
          :meta="packMeta[pack.name] ?? null"
          :is-default="defaultPacks.includes(pack.name)"
          :selected="selectedPacks.includes(pack.name)"
          @open="openPack(pack.name)"
          @toggle-select="togglePackSelection(pack.name)"
          @rename="onRename(pack.name, $event)"
        />
      </div>
    </div>

    <AdminCardManagerAddModal
      v-model="showAdd"
      :available-packs="allPackNames"
      @add="onAddCard"
    />
  </div>
</template>
