<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { watchDebounced } from "@vueuse/core";
import { useCardSearch } from "~/composables/useCardSearch";
import { useAdminPackStats } from "~/composables/useAdminPackStats";
import { useAdminCardList } from "~/composables/useAdminCardList";
import { useAdminCardMutations } from "~/composables/useAdminCardMutations";
import { getCardImageUrl } from "~/utils/cardImage";
import type { AdminCard } from "~/composables/useAdminCardList";

definePageMeta({ middleware: "admin" });

// ── Shared search state (persists across navigation) ──────────────────────────
const { searchTerm, cardType, selectedPack } = useCardSearch();

// ── Data layers ───────────────────────────────────────────────────────────────
const packs = useAdminPackStats();
const {
  packStats,
  loadingPacks,
  packSearchTerm,
  sortedPacks,
  defaultPacks,
  selectedPacks,
  packMeta,
  loadPacks,
  loadDefaultPacks,
  loadPackMeta,
  applyPackMeta,
  toggleDefaultPack,
  togglePackSelection,
  clearPackSelection,
  typeStatDotClass,
} = packs;

const list = useAdminCardList();
const {
  cards,
  visibleCards,
  totalCards,
  loadingCards,
  isFetchingBackground,
  isPageTransitioning,
  numPick,
  currentPage,
  pageSize,
  selectedCardIds,
  isCardSelected,
  toggleCardSelected,
  selectCardRangeTo,
  selectAllLoaded,
  clearCardSelection,
  fetchCards,
} = list;

const {
  bulkActionLoading,
  toggleCardActive,
  saveCardEdit: commitCardEdit,
  deleteCard,
  createCard,
  togglePackActive,
  togglePackActiveAll,
  deletePackAll,
  deletePackType,
  bulkTogglePacks,
  bulkDeletePacks,
  moveSelectedCards,
  renamePack,
  mergePacks,
} = useAdminCardMutations({ list, packs });

// ── Sidebar UI state ──────────────────────────────────────────────────────────
const packSidebarOpen = ref(true);
const expandedPack = ref<string | null>(null);

const togglePackExpand = (packName: string) => {
  expandedPack.value = expandedPack.value === packName ? null : packName;
};

const selectPack = (packName: string) => {
  if (selectedPack.value === packName) {
    togglePackExpand(packName);
    return;
  }
  expandedPack.value = packName;
  // Fall back to the type that actually has cards, so clicking a
  // white-only pack while "black" is selected doesn't show an empty grid.
  const stats = packStats.value[packName];
  if (stats) {
    if (
      cardType.value === "black" &&
      stats.black.total === 0 &&
      stats.white.total > 0
    ) {
      cardType.value = "white";
    } else if (
      cardType.value === "white" &&
      stats.white.total === 0 &&
      stats.black.total > 0
    ) {
      cardType.value = "black";
    }
  }
  selectedPack.value = packName;
};

const selectPackType = (packName: string, type: "black" | "white") => {
  // Deselect if already active
  if (selectedPack.value === packName && cardType.value === type) {
    selectedPack.value = undefined;
    return;
  }
  // Set both atomically so the unified watcher only fires once
  cardType.value = type;
  selectedPack.value = packName;
  expandedPack.value = packName;
};

// ── Modals ────────────────────────────────────────────────────────────────────
const showEditModal = ref(false);
const editingCard = ref<AdminCard | null>(null);
const showAddModal = ref(false);

const openEditModal = (card: AdminCard) => {
  editingCard.value = { ...card };
  showEditModal.value = true;
};

const saveCardEdit = async (updateData: Record<string, unknown>) => {
  if (await commitCardEdit(updateData)) showEditModal.value = false;
};

const handleAddCard = async (payload: Record<string, unknown>) => {
  if (await createCard(payload)) showAddModal.value = false;
};

// ── Pack reorganisation dialogs ──────────────────────────────────────────────
const showMoveModal = ref(false);
const moveTarget = ref("");

const showRenameModal = ref(false);
const renameSource = ref("");
const renameTarget = ref("");

const showMergeModal = ref(false);
const mergeTarget = ref("");

const showDetailsModal = ref(false);
const detailsPack = ref("");

const allPackNames = computed(() => Object.keys(packStats.value).sort());

const openMoveModal = () => {
  moveTarget.value = "";
  showMoveModal.value = true;
};

const confirmMove = async () => {
  if (await moveSelectedCards(moveTarget.value)) showMoveModal.value = false;
};

const openRenameModal = (packName: string) => {
  renameSource.value = packName;
  renameTarget.value = packName;
  showRenameModal.value = true;
};

const confirmRename = async () => {
  if (await renamePack(renameSource.value, renameTarget.value)) {
    showRenameModal.value = false;
  }
};

const openMergeModal = (packName?: string) => {
  // Merging from a pack's own kebab menu ticks it as the single source.
  if (packName && !selectedPacks.value.includes(packName)) {
    togglePackSelection(packName);
  }
  mergeTarget.value = "";
  showMergeModal.value = true;
};

const confirmMerge = async () => {
  if (await mergePacks([...selectedPacks.value], mergeTarget.value)) {
    showMergeModal.value = false;
  }
};

const openDetailsModal = (packName: string) => {
  detailsPack.value = packName;
  showDetailsModal.value = true;
};

const packMenuItems = (packName: string) => [
  [
    {
      label: "Rename pack…",
      icon: "i-solar-pen-new-square-line-duotone",
      onSelect: () => openRenameModal(packName),
    },
    {
      label: "Merge into…",
      icon: "i-solar-arrow-right-down-line-duotone",
      onSelect: () => openMergeModal(packName),
    },
    {
      label: "Edit details…",
      icon: "i-solar-settings-line-duotone",
      onSelect: () => openDetailsModal(packName),
    },
  ],
];

// ── Watchers ──────────────────────────────────────────────────────────────────
// Single unified watcher — batches simultaneous type+pack changes into one fetch
watch([cardType, selectedPack], () => {
  currentPage.value = 1;
  fetchCards();
});

watchDebounced(
  [searchTerm, numPick],
  () => {
    currentPage.value = 1;
    fetchCards();
  },
  { debounce: 400, maxWait: 900 },
);

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([loadPacks(), loadDefaultPacks(), loadPackMeta()]);
  if (selectedPack.value || searchTerm.value) await fetchCards();
});
</script>

<template>
  <div class="min-h-screen">
    <!-- ── Page Header ──────────────────────────────────────────────────────── -->
    <div class="max-w-[1600px] mx-auto px-4 py-6">
      <!-- Breadcrumb + title -->
      <div class="flex items-center gap-2 mb-1 text-sm text-slate-400">
        <NuxtLink to="/admin" class="hover:text-white transition-colors"
          >Admin</NuxtLink
        >
        <UIcon name="i-solar-alt-arrow-right-linear" class="text-xs" />
        <span class="text-white">Card Manager</span>
      </div>
      <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"
      >
        <div>
          <h1 class="text-4xl font-bold tracking-tight">Card Manager</h1>
          <p class="text-slate-400 mt-1">
            Manage packs, browse previews, edit and curate cards
          </p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <UButton
            to="/admin/cards/upload"
            icon="i-solar-cloud-upload-bold-duotone"
            color="primary"
            variant="soft"
          >
            Upload Pack
          </UButton>
          <UButton
            to="/admin/cards/duplicates"
            icon="i-solar-copy-bold-duotone"
            color="warning"
            variant="soft"
          >
            Find Duplicates
          </UButton>
          <UButton
            icon="i-solar-add-circle-bold-duotone"
            color="success"
            variant="soft"
            @click="showAddModal = true"
          >
            Add Card
          </UButton>
        </div>
      </div>

      <!-- ── Toolbar ────────────────────────────────────────────────────────── -->
      <div
        class="flex flex-wrap items-center gap-3 mb-6 p-3 rounded-xl bg-slate-800/60 backdrop-blur border border-slate-700/50"
      >
        <!-- Card type toggle -->
        <div class="flex rounded-lg overflow-hidden border border-slate-600/50">
          <button
            class="px-3 py-1.5 text-sm font-semibold transition-colors"
            :class="
              cardType === 'black'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-700/40 text-slate-400 hover:text-white'
            "
            @click="cardType = 'black'"
          >
            🖤 Black
          </button>
          <button
            class="px-3 py-1.5 text-sm font-semibold transition-colors"
            :class="
              cardType === 'white'
                ? 'bg-slate-200 text-slate-900'
                : 'bg-slate-700/40 text-slate-400 hover:text-white'
            "
            @click="cardType = 'white'"
          >
            🤍 White
          </button>
        </div>

        <!-- Search -->
        <UInput
          v-model="searchTerm"
          placeholder="Search cards..."
          icon="i-solar-magnifer-broken"
          class="flex-1 min-w-48"
          size="sm"
        />

        <!-- Pick filter (black only) -->
        <div v-if="cardType === 'black'" class="flex items-center gap-2">
          <span class="text-xs text-slate-400 whitespace-nowrap"
            >Pick filter:</span
          >
          <USelectMenu
            v-model="numPick"
            :items="[
              { label: 'Any', value: 0 },
              { label: 'Pick 1', value: 1 },
              { label: 'Pick 2', value: 2 },
              { label: 'Pick 3', value: 3 },
            ]"
            value-key="value"
            label-key="label"
            size="sm"
            class="w-28"
          />
        </div>

        <!-- Pack clear -->
        <UButton
          v-if="selectedPack"
          size="sm"
          variant="ghost"
          color="neutral"
          icon="i-solar-close-circle-bold-duotone"
          @click="
            selectedPack = undefined;
            fetchCards();
          "
        >
          Clear pack filter
        </UButton>

        <!-- Card count & background fetch indicator -->
        <div class="ml-auto flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
          <UIcon
            v-if="isFetchingBackground || loadingCards"
            name="i-solar-refresh-circle-bold-duotone"
            class="animate-spin text-sm text-primary-400"
          />
          <span>{{ totalCards.toLocaleString() }} cards loaded</span>
        </div>
      </div>

      <!-- ── Main Layout ─────────────────────────────────────────────────────── -->
      <div class="flex gap-4">
        <!-- ── Pack Sidebar ─────────────────────────────────────────────────── -->
        <div
          class="flex-shrink-0 transition-all duration-300"
          :class="packSidebarOpen ? 'w-80' : 'w-10'"
        >
          <!-- Collapse toggle -->
          <div class="flex items-center justify-between mb-3">
            <span
              v-if="packSidebarOpen"
              class="text-xs font-semibold uppercase tracking-widest text-slate-400"
            >
              Packs ({{ sortedPacks.length }})
            </span>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              :icon="
                packSidebarOpen
                  ? 'i-solar-alt-arrow-left-linear'
                  : 'i-solar-alt-arrow-right-linear'
              "
              @click="packSidebarOpen = !packSidebarOpen"
            />
          </div>

          <!-- Pack search -->
          <UInput
            v-if="packSidebarOpen"
            v-model="packSearchTerm"
            placeholder="Search packs..."
            icon="i-solar-magnifer-broken"
            size="sm"
            class="w-full mb-2"
          />

          <!-- Bulk-select action bar -->
          <div
            v-if="packSidebarOpen && selectedPacks.length"
            class="flex items-center gap-1.5 mb-2 p-1.5 rounded-lg bg-slate-800/80 border border-slate-600/40 flex-wrap"
          >
            <span class="text-xs text-slate-300 px-1">{{ selectedPacks.length }} selected</span>
            <UButton
              size="xs"
              color="success"
              variant="soft"
              icon="i-solar-check-circle-bold-duotone"
              :loading="bulkActionLoading"
              @click="bulkTogglePacks(true)"
            >
              Activate
            </UButton>
            <UButton
              size="xs"
              color="error"
              variant="soft"
              icon="i-solar-close-circle-bold-duotone"
              :loading="bulkActionLoading"
              @click="bulkTogglePacks(false)"
            >
              Deactivate
            </UButton>
            <UButton
              size="xs"
              color="error"
              variant="soft"
              icon="i-solar-trash-bin-trash-bold-duotone"
              :loading="bulkActionLoading"
              @click="bulkDeletePacks"
            >
              Delete
            </UButton>
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-solar-arrow-right-down-line-duotone"
              :loading="bulkActionLoading"
              @click="openMergeModal()"
            >
              Merge…
            </UButton>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              @click="clearPackSelection"
            >
              Clear
            </UButton>
          </div>

          <!-- Pack list -->
          <div
            v-if="packSidebarOpen"
            class="space-y-0.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 scrollbar-thin"
          >
            <!-- Loading skeleton -->
            <template v-if="loadingPacks">
              <div
                v-for="i in 8"
                :key="i"
                class="flex items-center gap-2 p-2 rounded-lg"
              >
                <USkeleton class="h-4 flex-1" />
                <USkeleton class="h-4 w-8" />
              </div>
            </template>

            <!-- Pack items with sub-menus -->
            <div v-for="pack in sortedPacks" :key="pack.name">
              <!-- Pack header row -->
              <div
                class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors group/pack"
                :class="
                  selectedPack === pack.name
                    ? 'bg-slate-700/80 text-white border border-primary-500/50 shadow-sm'
                    : expandedPack === pack.name
                      ? 'bg-slate-700/50 text-white border border-slate-600/40'
                      : 'text-slate-300 hover:bg-slate-700/40 border border-transparent'
                "
              >
                <!-- Bulk-select checkbox -->
                <UCheckbox
                  :model-value="selectedPacks.includes(pack.name)"
                  size="sm"
                  @update:model-value="togglePackSelection(pack.name)"
                  @click.stop
                />

                <!-- Select pack and expand trigger -->
                <button
                  class="flex-1 flex items-center gap-2 min-w-0 text-left"
                  @click="selectPack(pack.name)"
                >
                  <!-- Pack icon, when its metadata sets one -->
                  <span
                    v-if="packMeta[pack.name]?.icon"
                    class="text-xs flex-shrink-0"
                    >{{ packMeta[pack.name]?.icon }}</span
                  >

                  <!-- Two status dots: black + white -->
                  <span class="flex gap-0.5 flex-shrink-0">
                    <span
                      class="w-1.5 h-1.5 rounded-full"
                      :class="typeStatDotClass(pack.black)"
                    />
                    <span
                      class="w-1.5 h-1.5 rounded-full opacity-70"
                      :class="typeStatDotClass(pack.white)"
                    />
                  </span>

                  <!-- Pack name -->
                  <span
                    class="flex-1 min-w-0 line-clamp-2 break-words font-medium text-xs leading-tight"
                    :title="pack.name"
                    >{{ pack.name }}</span
                  >

                  <!-- Combined total -->
                  <span class="text-xs text-slate-500 flex-shrink-0">{{
                    pack.black.total + pack.white.total
                  }}</span>
                </button>

                <!-- Default-pack star -->
                <UTooltip
                  :text="
                    defaultPacks.includes(pack.name)
                      ? 'Default for new games'
                      : 'Set as default for new games'
                  "
                >
                  <UButton
                    size="xs"
                    variant="ghost"
                    :color="defaultPacks.includes(pack.name) ? 'warning' : 'neutral'"
                    :icon="
                      defaultPacks.includes(pack.name)
                        ? 'i-solar-star-bold-duotone'
                        : 'i-solar-star-linear'
                    "
                    @click.stop="toggleDefaultPack(pack.name)"
                  />
                </UTooltip>

                <!-- Pack actions -->
                <UDropdownMenu :items="packMenuItems(pack.name)">
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    icon="i-solar-menu-dots-bold"
                    @click.stop
                  />
                </UDropdownMenu>

                <!-- Combined activate/deactivate/delete (both card types at once) -->
                <div
                  class="flex gap-0.5 opacity-0 group-hover/pack:opacity-100 transition-opacity flex-shrink-0"
                >
                  <UTooltip text="Activate entire pack (white + black)">
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="success"
                      icon="i-solar-check-circle-bold-duotone"
                      :disabled="
                        pack.black.active === pack.black.total &&
                        pack.white.active === pack.white.total
                      "
                      @click.stop="togglePackActiveAll(pack.name, true)"
                    />
                  </UTooltip>
                  <UTooltip text="Deactivate entire pack (white + black)">
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="error"
                      icon="i-solar-close-circle-bold-duotone"
                      :disabled="pack.black.active === 0 && pack.white.active === 0"
                      @click.stop="togglePackActiveAll(pack.name, false)"
                    />
                  </UTooltip>
                  <UTooltip text="Delete entire pack">
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="error"
                      icon="i-solar-trash-bin-trash-bold-duotone"
                      @click.stop="deletePackAll(pack.name)"
                    />
                  </UTooltip>
                </div>

                <!-- Chevron -->
                <button @click.stop="togglePackExpand(pack.name)">
                  <UIcon
                    :name="
                      expandedPack === pack.name
                        ? 'i-solar-alt-arrow-up-linear'
                        : 'i-solar-alt-arrow-down-linear'
                    "
                    class="text-xs text-slate-500 flex-shrink-0"
                  />
                </button>
              </div>

              <!-- Sub-items -->
              <div
                v-if="expandedPack === pack.name"
                class="ml-3 mt-0.5 space-y-0.5 pb-1"
              >
                <!-- Black sub-item -->
                <button
                  class="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-xs transition-colors group/sub"
                  :class="
                    selectedPack === pack.name && cardType === 'black'
                      ? 'bg-slate-900 text-white border border-slate-600/50'
                      : 'text-slate-400 hover:bg-slate-800/60 border border-transparent'
                  "
                  @click="selectPackType(pack.name, 'black')"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    :class="typeStatDotClass(pack.black)"
                  />
                  <span class="flex-1">🖤 Black</span>
                  <span class="text-slate-500 flex-shrink-0">{{
                    pack.black.total
                  }}</span>
                  <!-- Quick toggles — only when this type is currently loaded -->
                  <div
                    v-if="selectedPack === pack.name && cardType === 'black'"
                    class="flex gap-0.5 opacity-0 group-hover/sub:opacity-100 transition-opacity flex-shrink-0"
                    @click.stop
                  >
                    <UTooltip text="Activate all">
                      <UButton
                        size="xs"
                        variant="ghost"
                        color="success"
                        icon="i-solar-check-circle-bold-duotone"
                        :disabled="pack.black.active === pack.black.total"
                        @click.stop="togglePackActive(pack.name, true)"
                      />
                    </UTooltip>
                    <UTooltip text="Deactivate all">
                      <UButton
                        size="xs"
                        variant="ghost"
                        color="error"
                        icon="i-solar-close-circle-bold-duotone"
                        :disabled="pack.black.active === 0"
                        @click.stop="togglePackActive(pack.name, false)"
                      />
                    </UTooltip>
                    <UTooltip text="Delete all black cards in this pack">
                      <UButton
                        size="xs"
                        variant="ghost"
                        color="error"
                        icon="i-solar-trash-bin-trash-bold-duotone"
                        :disabled="pack.black.total === 0"
                        @click.stop="deletePackType(pack.name, 'black')"
                      />
                    </UTooltip>
                  </div>
                </button>

                <!-- White sub-item -->
                <button
                  class="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-xs transition-colors group/sub"
                  :class="
                    selectedPack === pack.name && cardType === 'white'
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-slate-400 hover:bg-slate-800/60 border border-transparent'
                  "
                  @click="selectPackType(pack.name, 'white')"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    :class="typeStatDotClass(pack.white)"
                  />
                  <span class="flex-1">🤍 White</span>
                  <span class="text-slate-500 flex-shrink-0">{{
                    pack.white.total
                  }}</span>
                  <!-- Quick toggles — only when this type is currently loaded -->
                  <div
                    v-if="selectedPack === pack.name && cardType === 'white'"
                    class="flex gap-0.5 opacity-0 group-hover/sub:opacity-100 transition-opacity flex-shrink-0"
                    @click.stop
                  >
                    <UTooltip text="Activate all">
                      <UButton
                        size="xs"
                        variant="ghost"
                        color="success"
                        icon="i-solar-check-circle-bold-duotone"
                        :disabled="pack.white.active === pack.white.total"
                        @click.stop="togglePackActive(pack.name, true)"
                      />
                    </UTooltip>
                    <UTooltip text="Deactivate all">
                      <UButton
                        size="xs"
                        variant="ghost"
                        color="error"
                        icon="i-solar-close-circle-bold-duotone"
                        :disabled="pack.white.active === 0"
                        @click.stop="togglePackActive(pack.name, false)"
                      />
                    </UTooltip>
                    <UTooltip text="Delete all white cards in this pack">
                      <UButton
                        size="xs"
                        variant="ghost"
                        color="error"
                        icon="i-solar-trash-bin-trash-bold-duotone"
                        :disabled="pack.white.total === 0"
                        @click.stop="deletePackType(pack.name, 'white')"
                      />
                    </UTooltip>
                  </div>
                </button>
              </div>
            </div>

            <!-- Empty state -->
            <div
              v-if="!loadingPacks && sortedPacks.length === 0"
              class="text-xs text-slate-500 text-center py-4"
            >
              No packs found
            </div>
          </div>
        </div>

        <!-- ── Card Grid ───────────────────────────────────────────────────── -->
        <div class="flex-1 min-w-0">
          <!-- Loading grid skeleton (only when no cards exist) -->
          <div
            v-if="loadingCards && !cards.length"
            class="grid gap-3"
            style="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))"
          >
            <div
              v-for="i in 24"
              :key="i"
              class="aspect-[3/4] rounded-xl"
              :class="cardType === 'black' ? 'bg-slate-800' : 'bg-slate-300/20'"
            >
              <USkeleton class="w-full h-full rounded-xl" />
            </div>
          </div>

          <!-- Empty — no pack/search selected -->
          <div
            v-else-if="!cards.length && !selectedPack && !searchTerm && !loadingCards"
            class="flex flex-col items-center justify-center py-24 text-center"
          >
            <UIcon
              name="i-solar-inbox-bold-duotone"
              class="text-6xl text-slate-600 mb-4"
            />
            <p class="text-slate-400 text-lg font-medium">
              Select a pack from the sidebar
            </p>
            <p class="text-slate-500 text-sm mt-1">
              or use the search box to find cards
            </p>
          </div>

          <!-- Empty — search/filter yielded no results -->
          <div
            v-else-if="!cards.length && !loadingCards"
            class="flex flex-col items-center justify-center py-24 text-center"
          >
            <UIcon
              name="i-solar-ghost-bold-duotone"
              class="text-6xl text-slate-600 mb-4"
            />
            <p class="text-slate-400 text-lg font-medium">
              No cards match your filters
            </p>
          </div>

          <!-- Card grid -->
          <template v-else>
            <!-- Selection action bar -->
            <div
              v-if="selectedCardIds.length"
              class="flex items-center gap-2 flex-wrap mb-3 p-2 rounded-lg bg-slate-800/80 border border-slate-700/60"
            >
              <span class="text-xs text-slate-300 px-1">
                {{ selectedCardIds.length }} selected
              </span>
              <UButton
                size="xs"
                color="primary"
                variant="soft"
                icon="i-solar-folder-with-files-line-duotone"
                :loading="bulkActionLoading"
                @click="openMoveModal"
              >
                Move to pack…
              </UButton>
              <UButton
                v-if="selectedCardIds.length < cards.length"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="selectAllLoaded"
              >
                Select all {{ cards.length.toLocaleString() }}
              </UButton>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                @click="clearCardSelection"
              >
                Clear
              </UButton>
            </div>

            <div
              class="grid gap-3 transition-opacity duration-150"
              :class="
                isFetchingBackground || isPageTransitioning
                  ? 'opacity-50 pointer-events-none'
                  : 'opacity-100'
              "
              style="
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
              "
            >
              <AdminCardPreview
                v-for="card in visibleCards"
                :key="card.id"
                v-memo="[card.id, card.active, card.text, card.pick, card.imageKey, card.attachment?.offsetX, card.attachment?.offsetY, card.attachment?.scale, selectedCardIds.length, isCardSelected(card.id)]"
                :text="card.text"
                :pack="card.pack"
                :active="card.active"
                :type="cardType"
                :pick="card.pick"
                :image-url="card.imageKey ? getCardImageUrl(card.imageKey) : undefined"
                :attachment="card.attachment"
                :selected="isCardSelected(card.id)"
              >
                <template #actions>
                  <!-- Selection checkbox -->
                  <UCheckbox
                    :model-value="isCardSelected(card.id)"
                    size="sm"
                    @click.stop="
                      $event.shiftKey
                        ? selectCardRangeTo(card.id)
                        : toggleCardSelected(card.id)
                    "
                  />
                  <!-- Active toggle -->
                  <UTooltip :text="card.active ? 'Deactivate' : 'Activate'">
                    <UButton
                      size="xs"
                      :color="card.active ? 'error' : 'success'"
                      :icon="
                        card.active
                          ? 'i-solar-close-circle-bold-duotone'
                          : 'i-solar-check-circle-bold-duotone'
                      "
                      variant="soft"
                      @click.stop="toggleCardActive(card)"
                    />
                  </UTooltip>
                  <!-- Edit -->
                  <UTooltip text="Edit text">
                    <UButton
                      size="xs"
                      color="neutral"
                      icon="i-solar-pen-new-square-line-duotone"
                      variant="soft"
                      @click.stop="openEditModal(card)"
                    />
                  </UTooltip>
                  <!-- Delete -->
                  <UTooltip text="Delete card">
                    <UButton
                      size="xs"
                      color="error"
                      icon="i-solar-trash-bin-trash-bold-duotone"
                      variant="ghost"
                      @click.stop="deleteCard(card)"
                    />
                  </UTooltip>
                </template>
              </AdminCardPreview>
            </div>

            <!-- Pagination -->
            <div
              v-if="cards.length > pageSize"
              class="flex justify-between items-center mt-6"
            >
              <p class="text-sm text-slate-400">
                Showing {{ (currentPage - 1) * pageSize + 1 }}–{{
                  Math.min(currentPage * pageSize, cards.length)
                }}
                of {{ cards.length.toLocaleString() }} cards
              </p>
              <UPagination
                v-model:page="currentPage"
                :total="cards.length"
                :items-per-page="pageSize"
              />
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ── Edit Modal ──────────────────────────────────────────────────────── -->
    <AdminCardManagerEditModal
      v-if="editingCard"
      v-model="showEditModal"
      :card="editingCard"
      :card-type="cardType"
      @save="saveCardEdit"
    />

    <!-- ── Add Card Modal ─────────────────────────────────────────────────── -->
    <AdminCardManagerAddModal
      v-model="showAddModal"
      :available-packs="Object.keys(packStats)"
      @add="handleAddCard"
    />

    <!-- ── Move Cards Modal ────────────────────────────────────────────────── -->
    <UModal v-model:open="showMoveModal" title="Move cards to a pack">
      <template #body>
        <AdminPackPicker
          v-model="moveTarget"
          :packs="allPackNames"
          :exclude="selectedPack ? [selectedPack] : []"
          :label="`Move ${selectedCardIds.length} card${selectedCardIds.length === 1 ? '' : 's'} to`"
        />
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" @click="showMoveModal = false">
            Cancel
          </UButton>
          <UButton
            color="primary"
            :disabled="!moveTarget.trim()"
            :loading="bulkActionLoading"
            @click="confirmMove"
          >
            Move cards
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- ── Rename Pack Modal ───────────────────────────────────────────────── -->
    <UModal v-model:open="showRenameModal" :title="`Rename ${renameSource}`">
      <template #body>
        <AdminPackPicker
          v-model="renameTarget"
          :packs="allPackNames"
          :exclude="[renameSource]"
          label="New name"
          placeholder="Type a new name, or pick a pack to merge into"
        />
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            @click="showRenameModal = false"
          >
            Cancel
          </UButton>
          <UButton
            color="primary"
            :disabled="!renameTarget.trim() || renameTarget === renameSource"
            :loading="bulkActionLoading"
            @click="confirmRename"
          >
            Rename
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- ── Merge Packs Modal ───────────────────────────────────────────────── -->
    <UModal v-model:open="showMergeModal" title="Merge packs">
      <template #body>
        <div class="flex flex-col gap-3">
          <p class="text-xs text-slate-400">
            Merging
            <span class="text-slate-200">{{ selectedPacks.join(", ") }}</span>
            into a destination. The destination keeps its own details and
            default status.
          </p>
          <AdminPackPicker
            v-model="mergeTarget"
            :packs="allPackNames"
            :exclude="selectedPacks"
            label="Merge into"
          />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            @click="showMergeModal = false"
          >
            Cancel
          </UButton>
          <UButton
            color="primary"
            :disabled="!mergeTarget.trim() || !selectedPacks.length"
            :loading="bulkActionLoading"
            @click="confirmMerge"
          >
            Merge packs
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- ── Pack Details Modal ──────────────────────────────────────────────── -->
    <AdminPackDetailsModal
      v-model:open="showDetailsModal"
      :pack="detailsPack"
      :meta="packMeta[detailsPack] ?? null"
      @saved="applyPackMeta"
    />
  </div>
</template>
