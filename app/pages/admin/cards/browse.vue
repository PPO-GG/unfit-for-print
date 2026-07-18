<script setup lang="ts">
import { getAppwrite } from "~/utils/appwrite";
import { Query } from "appwrite";
import { useNotifications } from "~/composables/useNotifications";
import { useCardSearch } from "~/composables/useCardSearch";
import { useUserStore } from "~/stores/userStore";
import { watchDebounced } from "@vueuse/core";

definePageMeta({ middleware: "admin" });

const { tables } = getAppwrite();
const config = useRuntimeConfig();
const { notify } = useNotifications();
const userStore = useUserStore();

const authHeaders = () => ({
  Authorization: `Bearer ${userStore.session?.$id}`,
  "x-appwrite-user-id": userStore.user?.$id ?? "",
});

// ── Shared search state (persists across navigation) ──────────────────────────
const { searchTerm, cardType, selectedPack } = useCardSearch();

const DB_ID = config.public.appwriteDatabaseId as string;
const CARD_COLLECTIONS: Record<string, string> = {
  black: config.public.appwriteBlackCardCollectionId as string,
  white: config.public.appwriteWhiteCardCollectionId as string,
};
const CARD_COLLECTION = computed(
  () => CARD_COLLECTIONS[cardType.value] as string,
);

// ── Pack sidebar state ─────────────────────────────────────────────────────────
interface PackTypeStat {
  total: number;
  active: number;
}
interface PackStat {
  name: string;
  black: PackTypeStat;
  white: PackTypeStat;
}

const packStats = ref<Record<string, PackStat>>({});
const loadingPacks = ref(false);
const packSidebarOpen = ref(true);
const expandedPack = ref<string | null>(null);

const sortedPacks = computed(() =>
  Object.values(packStats.value).sort((a, b) => a.name.localeCompare(b.name)),
);

// ── Card grid state ────────────────────────────────────────────────────────────
const cards = ref<any[]>([]);
const loadingCards = ref(false);
const totalCards = ref(0);
const currentPage = ref(1);
const pageSize = ref(30);
const numPick = ref(0); // 0 = any (black only filter)

// Decoupled from currentPage so pagination can show a skeleton before swapping
const visibleCards = ref<any[]>([]);
const isPageTransitioning = ref(false);

const totalPages = computed(() =>
  Math.ceil(cards.value.length / pageSize.value),
);
// ↑ kept for the clamp logic in the cards watcher; UPagination uses items-per-page directly

// When the full card list refreshes, clamp page to valid range then update slice
watch(
  cards,
  () => {
    const maxPage = Math.max(1, Math.ceil(cards.value.length / pageSize.value));
    if (currentPage.value > maxPage) currentPage.value = 1;
    const start = (currentPage.value - 1) * pageSize.value;
    visibleCards.value = cards.value.slice(start, start + pageSize.value);
  },
  { immediate: true },
);

// When user changes page via pagination, show skeleton first → swap cards → hide
watch(currentPage, async () => {
  if (loadingCards.value) return; // Full fetch already owns the skeleton
  isPageTransitioning.value = true;
  await nextTick();
  const start = (currentPage.value - 1) * pageSize.value;
  visibleCards.value = cards.value.slice(start, start + pageSize.value);
  isPageTransitioning.value = false;
});

// ── Modals ─────────────────────────────────────────────────────────────────────
const showEditModal = ref(false);
const editingCard = ref<any>(null);

const showAddModal = ref(false);
const newCardText = ref("");
const newCardPack = ref("");
const newCardType = ref<"white" | "black">("white");
const newCardPicks = ref(1);

// Handler that receives the cardData emitted by AddModal
const handleAddCard = async (cardData: {
  text: string;
  pack: string;
  type: "white" | "black";
  pick?: number;
}) => {
  newCardText.value = cardData.text;
  newCardPack.value = cardData.pack;
  newCardType.value = cardData.type;
  newCardPicks.value = cardData.pick ?? 1;
  await addSingleCard();
};

// ── Load packs ────────────────────────────────────────────────────────────────
const loadPackStatsForType = async (
  collectionId: string,
): Promise<Record<string, PackTypeStat>> => {
  const stats: Record<string, PackTypeStat> = {};
  try {
    const countRes = await tables.listRows({
      databaseId: DB_ID,
      tableId: collectionId,
      queries: [Query.limit(1)],
    });
    const total = countRes.total;
    const chunkSize = 1000;
    for (let offset = 0; offset < total; offset += chunkSize) {
      const res = await tables.listRows({
        databaseId: DB_ID,
        tableId: collectionId,
        queries: [Query.limit(chunkSize), Query.offset(offset)],
      });
      for (const doc of res.rows) {
        const p: string = doc.pack || "(no pack)";
        if (!stats[p]) stats[p] = { total: 0, active: 0 };
        stats[p].total++;
        if (doc.active) stats[p].active++;
      }
      if (res.rows.length < chunkSize) break;
    }
  } catch (err) {
    console.error("Failed to load pack stats:", err);
  }
  return stats;
};

const loadPacks = async () => {
  if (!tables) return;
  loadingPacks.value = true;
  packStats.value = {};
  try {
    const [blackStats, whiteStats] = await Promise.all([
      loadPackStatsForType(CARD_COLLECTIONS.black!),
      loadPackStatsForType(CARD_COLLECTIONS.white!),
    ]);
    const allNames = new Set([
      ...Object.keys(blackStats),
      ...Object.keys(whiteStats),
    ]);
    const merged: Record<string, PackStat> = {};
    for (const name of allNames) {
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

// ── Fetch cards for selected pack / search ────────────────────────────────────
const fetchCards = async () => {
  if (!tables) return;
  loadingCards.value = true;
  cards.value = [];

  try {
    const queries: any[] = [];

    if (selectedPack.value)
      queries.push(Query.equal("pack", selectedPack.value));
    if (cardType.value === "black" && numPick.value > 0)
      queries.push(Query.equal("pick", numPick.value));

    let clientFilter = false;
    if (searchTerm.value) {
      try {
        queries.push(Query.search("text", searchTerm.value));
        await tables.listRows({
          databaseId: DB_ID,
          tableId: CARD_COLLECTION.value,
          queries: [...queries, Query.limit(1)],
        });
      } catch {
        queries.pop();
        clientFilter = true;
      }
    }

    const countRes = await tables.listRows({
      databaseId: DB_ID,
      tableId: CARD_COLLECTION.value,
      queries: [...queries, Query.limit(1)],
    });
    const matchTotal = countRes.total;
    if (matchTotal === 0) {
      loadingCards.value = false;
      return;
    }

    const chunkSize = 1000;
    const all: any[] = [];
    for (let offset = 0; offset < matchTotal; offset += chunkSize) {
      const res = await tables.listRows({
        databaseId: DB_ID,
        tableId: CARD_COLLECTION.value,
        queries: [...queries, Query.limit(chunkSize), Query.offset(offset)],
      });
      all.push(...res.rows);
      if (res.rows.length < chunkSize) break;
    }

    let filtered = all;
    if (clientFilter && searchTerm.value) {
      const term = searchTerm.value.toLowerCase();
      filtered = all.filter(
        (c) =>
          c.text?.toLowerCase().includes(term) ||
          c.$id?.toLowerCase().includes(term),
      );
    }

    cards.value = filtered;
    totalCards.value = filtered.length;
    currentPage.value = 1;
  } catch (err) {
    console.error("Failed to fetch cards:", err);
  } finally {
    loadingCards.value = false;
  }
};

// ── Card CRUD ─────────────────────────────────────────────────────────────────
const toggleCardActive = async (card: any) => {
  try {
    const updated = await tables.updateRow({
      databaseId: DB_ID,
      tableId: CARD_COLLECTION.value,
      rowId: card.$id,
      data: { active: !card.active },
    });
    card.active = updated.active;
    // Update pack stat for the currently loaded type
    const packName = card.pack || "(no pack)";
    const typeKey = cardType.value as "black" | "white";
    if (packStats.value[packName]) {
      packStats.value[packName][typeKey].active += updated.active ? 1 : -1;
    }
  } catch (err) {
    notify({
      title: "Update Failed",
      description: "Could not toggle card status.",
      color: "error",
    });
  }
};

const togglePackActive = async (pack: string, setActive: boolean) => {
  const packCards = cards.value.filter((c) => c.pack === pack);
  if (!packCards.length) return;

  loadingCards.value = true;
  try {
    await Promise.all(
      packCards.map((card) =>
        tables.updateRow({
          databaseId: DB_ID,
          tableId: CARD_COLLECTION.value,
          rowId: card.$id,
          data: { active: setActive },
        }),
      ),
    );
    packCards.forEach((c) => (c.active = setActive));
    if (packStats.value[pack]) {
      const typeKey = cardType.value as "black" | "white";
      packStats.value[pack][typeKey].active = setActive
        ? packStats.value[pack][typeKey].total
        : 0;
    }
    notify({
      title: `Pack ${setActive ? "Activated" : "Deactivated"}`,
      description: `All cards in "${pack}" have been ${setActive ? "activated" : "deactivated"}.`,
      color: "success",
    });
  } catch {
    notify({
      title: "Update Failed",
      description: "Could not toggle pack status.",
      color: "error",
    });
  } finally {
    loadingCards.value = false;
  }
};

const openEditModal = (card: any) => {
  editingCard.value = { ...card };
  showEditModal.value = true;
};

const saveCardEdit = async (updateData: any) => {
  try {
    const updated = await tables.updateRow({
      databaseId: DB_ID,
      tableId: CARD_COLLECTION.value,
      rowId: updateData.$id,
      data: {
        text: updateData.text,
        ...(updateData.pick ? { pick: updateData.pick } : {}),
      },
    });
    const idx = cards.value.findIndex((c) => c.$id === updated.$id);
    if (idx !== -1) {
      cards.value[idx].text = updated.text;
      if (updated.pick) cards.value[idx].pick = updated.pick;
    }
    showEditModal.value = false;
    notify({ title: "Card Updated", color: "success" });
  } catch {
    notify({ title: "Update Failed", color: "error" });
  }
};

const deleteCard = async (card: any) => {
  try {
    await tables.deleteRow({
      databaseId: DB_ID,
      tableId: CARD_COLLECTION.value,
      rowId: card.$id,
    });
    cards.value = cards.value.filter((c) => c.$id !== card.$id);
    totalCards.value--;
    const packName = card.pack || "(no pack)";
    if (packStats.value[packName]) {
      const typeKey = cardType.value as "black" | "white";
      packStats.value[packName][typeKey].total--;
      if (card.active) packStats.value[packName][typeKey].active--;
      const s = packStats.value[packName];
      if (s.black.total <= 0 && s.white.total <= 0)
        delete packStats.value[packName];
    }
    notify({ title: "Card Deleted", color: "success" });
  } catch {
    notify({ title: "Delete Failed", color: "error" });
  }
};

const addSingleCard = async () => {
  if (!newCardText.value.trim() || !newCardPack.value) return;

  loadingCards.value = true;
  try {
    const collectionId = CARD_COLLECTION.value;
    const cardData: any = {
      text: newCardText.value.trim(),
      pack: newCardPack.value,
      active: true,
    };
    if (newCardType.value === "black") cardData.pick = newCardPicks.value;

    const newCard = await tables.createRow({
      databaseId: DB_ID,
      tableId: collectionId,
      rowId: "unique()",
      data: cardData,
    });

    // Add to grid if currently viewing this pack/type
    if (
      cardType.value === newCardType.value &&
      (!selectedPack.value || selectedPack.value === newCardPack.value)
    ) {
      cards.value.unshift(newCard);
      totalCards.value++;
    }

    // Update pack stats for the relevant type
    const packName = newCardPack.value || "(no pack)";
    if (!packStats.value[packName])
      packStats.value[packName] = {
        name: packName,
        black: { total: 0, active: 0 },
        white: { total: 0, active: 0 },
      };
    packStats.value[packName][newCardType.value].total++;
    packStats.value[packName][newCardType.value].active++;

    showAddModal.value = false;
    newCardText.value = "";
    newCardPack.value = "";
    newCardType.value = "white";
    newCardPicks.value = 1;
    notify({
      title: "Card Added",
      description: `Added to pack "${newCard.pack}"`,
      color: "success",
    });
  } catch {
    notify({ title: "Add Failed", color: "error" });
  } finally {
    loadingCards.value = false;
  }
};

// ── Pack sidebar helpers ──────────────────────────────────────────────────────
const togglePackExpand = (packName: string) => {
  expandedPack.value = expandedPack.value === packName ? null : packName;
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

const typeStatDotClass = (stat: PackTypeStat) => {
  if (stat.active === 0) return "bg-red-500";
  if (stat.active === stat.total) return "bg-green-400";
  return "bg-yellow-400";
};

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
  await loadPacks();
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

        <!-- Card count -->
        <span class="ml-auto text-xs text-slate-400 whitespace-nowrap">
          {{ totalCards.toLocaleString() }} cards loaded
        </span>
      </div>

      <!-- ── Main Layout ─────────────────────────────────────────────────────── -->
      <div class="flex gap-4">
        <!-- ── Pack Sidebar ─────────────────────────────────────────────────── -->
        <div
          class="flex-shrink-0 transition-all duration-300"
          :class="packSidebarOpen ? 'w-64' : 'w-10'"
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
              <!-- Pack header row (click to expand) -->
              <button
                class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors group/pack"
                :class="
                  expandedPack === pack.name
                    ? 'bg-slate-700/60 text-white border border-slate-600/40'
                    : 'text-slate-300 hover:bg-slate-700/50 border border-transparent'
                "
                @click="togglePackExpand(pack.name)"
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
                  class="flex-1 truncate font-medium text-xs leading-tight"
                  >{{ pack.name }}</span
                >

                <!-- Combined total -->
                <span class="text-xs text-slate-500 flex-shrink-0">{{
                  pack.black.total + pack.white.total
                }}</span>

                <!-- Chevron -->
                <UIcon
                  :name="
                    expandedPack === pack.name
                      ? 'i-solar-alt-arrow-up-linear'
                      : 'i-solar-alt-arrow-down-linear'
                  "
                  class="text-xs text-slate-500 flex-shrink-0"
                />
              </button>

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
          <!-- Loading grid skeleton -->
          <div
            v-if="loadingCards || isPageTransitioning"
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
            v-else-if="!cards.length && !selectedPack && !searchTerm"
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
            v-else-if="!cards.length"
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
            <div
              class="grid gap-3"
              style="
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
              "
            >
              <AdminCardPreview
                v-for="card in visibleCards"
                :key="card.$id"
                v-memo="[card.$id, card.active, card.text, card.pick]"
                :text="card.text"
                :pack="card.pack"
                :active="card.active"
                :type="cardType"
                :pick="card.pick"
              >
                <template #actions>
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
  </div>
</template>
