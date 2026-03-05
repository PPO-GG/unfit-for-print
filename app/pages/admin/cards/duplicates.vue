<script setup lang="ts">
import { getAppwrite } from "~/utils/appwrite";
import { Query } from "appwrite";
import { useCardSearch } from "~/composables/useCardSearch";
import { useCardSimilarity } from "~/composables/useCardSimilarity";
import { useNotifications } from "~/composables/useNotifications";

definePageMeta({ middleware: "admin" });

const { tables } = getAppwrite();
const config = useRuntimeConfig();
const { notify } = useNotifications();
const { cardType } = useCardSearch();

const DB_ID = config.public.appwriteDatabaseId as string;
const CARD_COLLECTIONS: Record<string, string> = {
  black: config.public.appwriteBlackCardCollectionId as string,
  white: config.public.appwriteWhiteCardCollectionId as string,
};
const CARD_COLLECTION = computed(() => CARD_COLLECTIONS[cardType.value]!);

const {
  processingAllSimilarCards,
  allSimilarPairs,
  similarityThreshold,
  scanProgress,
  scanStats,
  findAllSimilarCards,
} = useCardSimilarity();

// Local card list for scanning
const allCards = ref<any[]>([]);
const loadingCards = ref(false);
const currentPairIndex = ref(0);
const cardToKeep = ref<"card1" | "card2">("card1");
const deletingPair = ref(false);

const currentPair = computed(
  () => allSimilarPairs.value[currentPairIndex.value] ?? null,
);
const remainingPairs = computed(
  () => allSimilarPairs.value.length - currentPairIndex.value,
);

// Load all cards from Appwrite for the selected type
const loadCards = async () => {
  if (!tables) return;
  loadingCards.value = true;
  allCards.value = [];
  try {
    const countRes = await tables.listRows({
      databaseId: DB_ID,
      tableId: CARD_COLLECTION.value,
      queries: [Query.limit(1)],
    });
    const total = countRes.total;
    const chunkSize = 1000;
    for (let offset = 0; offset < total; offset += chunkSize) {
      const res = await tables.listRows({
        databaseId: DB_ID,
        tableId: CARD_COLLECTION.value,
        queries: [Query.limit(chunkSize), Query.offset(offset)],
      });
      allCards.value.push(...res.rows);
      if (res.rows.length < chunkSize) break;
    }
  } catch (err) {
    console.error("Failed to load cards:", err);
    notify({ title: "Failed to load cards", color: "error" });
  } finally {
    loadingCards.value = false;
  }
};

const runScan = async () => {
  currentPairIndex.value = 0;
  cardToKeep.value = "card1";
  await findAllSimilarCards(allCards.value);
};

const keepCard = async () => {
  if (!currentPair.value) return;
  deletingPair.value = true;
  try {
    const cardToDelete =
      cardToKeep.value === "card1"
        ? currentPair.value.card2
        : currentPair.value.card1;

    await tables.deleteRow({
      databaseId: DB_ID,
      tableId: CARD_COLLECTION.value,
      rowId: cardToDelete.$id,
    });

    // Remove deleted card from allCards too
    allCards.value = allCards.value.filter((c) => c.$id !== cardToDelete.$id);

    // Remove current pair and any pairs that also reference the deleted card
    allSimilarPairs.value = allSimilarPairs.value.filter(
      (p, i) =>
        i !== currentPairIndex.value &&
        p.card1.$id !== cardToDelete.$id &&
        p.card2.$id !== cardToDelete.$id,
    );

    // Keep index in bounds
    if (currentPairIndex.value >= allSimilarPairs.value.length) {
      currentPairIndex.value = Math.max(0, allSimilarPairs.value.length - 1);
    }
    cardToKeep.value = "card1";

    notify({
      title: "Card deleted",
      description: `"${cardToDelete.text.slice(0, 60)}..."`,
      color: "success",
    });
  } catch (err) {
    notify({ title: "Delete failed", color: "error" });
  } finally {
    deletingPair.value = false;
  }
};

const skipPair = () => {
  if (currentPairIndex.value < allSimilarPairs.value.length - 1) {
    currentPairIndex.value++;
    cardToKeep.value = "card1";
  }
};

const prevPair = () => {
  if (currentPairIndex.value > 0) {
    currentPairIndex.value--;
    cardToKeep.value = "card1";
  }
};

watch(cardType, () => {
  allCards.value = [];
  allSimilarPairs.value = [];
  currentPairIndex.value = 0;
});

onMounted(() => loadCards());
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 mb-1 text-sm text-slate-400">
      <NuxtLink to="/admin" class="hover:text-white transition-colors"
        >Admin</NuxtLink
      >
      <UIcon name="i-solar-alt-arrow-right-linear" class="text-xs" />
      <NuxtLink to="/admin/cards" class="hover:text-white transition-colors"
        >Card Manager</NuxtLink
      >
      <UIcon name="i-solar-alt-arrow-right-linear" class="text-xs" />
      <span class="text-white">Find Duplicates</span>
    </div>

    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-4xl font-bold tracking-tight">Duplicate Scanner</h1>
        <p class="text-slate-400 mt-1">
          Find and resolve near-duplicate cards across packs
        </p>
      </div>
      <UButton
        to="/admin/cards"
        variant="ghost"
        color="neutral"
        icon="i-solar-alt-arrow-left-linear"
      >
        Back to Cards
      </UButton>
    </div>

    <!-- Config panel -->
    <UCard class="mb-6">
      <div class="flex flex-wrap items-end gap-6">
        <!-- Card type selector -->
        <div class="flex flex-col gap-1">
          <label
            class="text-xs font-semibold uppercase tracking-wider text-slate-400"
            >Card Type</label
          >
          <div
            class="flex rounded-lg overflow-hidden border border-slate-600/50"
          >
            <button
              class="px-4 py-2 text-sm font-semibold transition-colors"
              :class="
                cardType === 'black'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-700/40 text-slate-400 hover:text-white'
              "
              @click="
                cardType = 'black';
                loadCards();
              "
            >
              🖤 Black ({{
                allCards.filter((c) => cardType === "black").length ||
                allCards.length
              }})
            </button>
            <button
              class="px-4 py-2 text-sm font-semibold transition-colors"
              :class="
                cardType === 'white'
                  ? 'bg-slate-200 text-slate-900'
                  : 'bg-slate-700/40 text-slate-400 hover:text-white'
              "
              @click="
                cardType = 'white';
                loadCards();
              "
            >
              🤍 White
            </button>
          </div>
        </div>

        <!-- Threshold slider -->
        <div class="flex flex-col gap-1 flex-1 min-w-48">
          <label
            class="text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            Similarity Threshold: {{ Math.round(similarityThreshold * 100) }}%
          </label>
          <input
            v-model.number="similarityThreshold"
            type="range"
            min="0.5"
            max="0.99"
            step="0.01"
            class="w-full accent-primary-500"
          />
          <div class="flex justify-between text-xs text-slate-500">
            <span>50% (loose)</span>
            <span>99% (strict)</span>
          </div>
        </div>

        <!-- Scan button -->
        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-solar-refresh-bold-duotone"
            :loading="loadingCards"
            @click="loadCards"
          >
            Reload Cards
          </UButton>
          <UButton
            color="warning"
            icon="i-solar-copy-bold-duotone"
            :loading="processingAllSimilarCards"
            :disabled="allCards.length === 0 || loadingCards"
            @click="runScan"
          >
            Scan {{ allCards.length.toLocaleString() }} Cards
          </UButton>
        </div>
      </div>

      <!-- Loading indicator -->
      <div
        v-if="loadingCards"
        class="mt-4 flex items-center gap-2 text-sm text-slate-400"
      >
        <UIcon name="i-solar-loading-bold-duotone" class="animate-spin" />
        Loading {{ allCards.length.toLocaleString() }} cards...
      </div>
    </UCard>

    <!-- No scan run yet -->
    <div
      v-if="allSimilarPairs.length === 0 && !processingAllSimilarCards"
      class="flex flex-col items-center justify-center py-24 text-center"
    >
      <UIcon
        name="i-solar-copy-bold-duotone"
        class="text-7xl text-slate-700 mb-6"
      />
      <p class="text-slate-400 text-lg font-medium">No scan results yet</p>
      <p class="text-slate-500 text-sm mt-1 mb-6">
        Load cards and click "Scan" to find duplicate or near-duplicate cards
      </p>
    </div>

    <!-- Scanning progress -->
    <div
      v-else-if="processingAllSimilarCards"
      class="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto"
    >
      <UIcon
        name="i-solar-copy-bold-duotone"
        class="text-6xl text-primary-400 mb-6"
      />
      <p class="text-slate-300 text-lg font-semibold mb-1">
        Scanning {{ allCards.length.toLocaleString() }} cards...
      </p>
      <p class="text-slate-500 text-sm mb-6">
        Running on a background thread — UI stays fully responsive
      </p>

      <!-- Progress bar -->
      <div class="w-full mb-3">
        <UProgress
          :value="Math.round(scanProgress * 100)"
          :max="100"
          color="primary"
          size="md"
        />
      </div>

      <!-- Stats -->
      <div
        class="flex items-center justify-between w-full text-xs text-slate-500"
      >
        <span>{{ Math.round(scanProgress * 100) }}% complete</span>
        <span v-if="scanStats.total > 0">
          {{ scanStats.processed.toLocaleString() }} /
          {{ scanStats.total.toLocaleString() }} pairs checked
        </span>
      </div>
    </div>

    <!-- Done — no duplicates found -->
    <div
      v-else-if="allSimilarPairs.length === 0"
      class="flex flex-col items-center justify-center py-24 text-center"
    >
      <UIcon
        name="i-solar-check-circle-bold-duotone"
        class="text-7xl text-green-400 mb-6"
      />
      <p class="text-slate-300 text-xl font-semibold">All clear!</p>
      <p class="text-slate-500 text-sm mt-1">
        No similar cards found above the
        {{ Math.round(similarityThreshold * 100) }}% threshold
      </p>
    </div>

    <!-- Pair review UI -->
    <div v-else class="space-y-4">
      <!-- Progress header -->
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <p class="text-lg font-semibold">
            Pair {{ currentPairIndex + 1 }} of {{ allSimilarPairs.length }}
          </p>
          <p class="text-sm text-slate-400">
            {{ remainingPairs }} pairs remaining. Select which card to keep.
          </p>
        </div>
        <div class="flex gap-2">
          <UButton
            size="sm"
            variant="ghost"
            color="neutral"
            icon="i-solar-alt-arrow-left-linear"
            :disabled="currentPairIndex === 0"
            @click="prevPair"
          >
            Prev
          </UButton>
          <UButton
            size="sm"
            variant="ghost"
            color="neutral"
            icon="i-solar-alt-arrow-right-linear"
            trailing
            :disabled="currentPairIndex >= allSimilarPairs.length - 1"
            @click="skipPair"
          >
            Skip
          </UButton>
        </div>
      </div>

      <!-- Progress bar -->
      <UProgress
        :value="currentPairIndex + 1"
        :max="allSimilarPairs.length"
        color="warning"
        size="xs"
      />

      <!-- Similarity badge -->
      <div class="flex justify-center">
        <UBadge
          :color="
            (currentPair?.similarityScore ?? 0) >= 95
              ? 'error'
              : (currentPair?.similarityScore ?? 0) >= 80
                ? 'warning'
                : 'info'
          "
          size="lg"
          :label="`${currentPair?.similarityScore ?? 0}% similar`"
        />
      </div>

      <!-- Side-by-side card comparison -->
      <div v-if="currentPair" class="grid grid-cols-2 gap-4">
        <!-- Card 1 -->
        <div
          class="rounded-xl border-2 p-4 cursor-pointer transition-all"
          :class="
            cardToKeep === 'card1'
              ? 'border-green-400 bg-green-400/5 shadow-[0_0_20px_rgba(74,222,128,0.15)]'
              : 'border-slate-700 hover:border-slate-500'
          "
          @click="cardToKeep = 'card1'"
        >
          <div class="flex items-center justify-between mb-3">
            <span
              class="text-xs font-bold uppercase tracking-wider text-slate-400"
              >Card 1</span
            >
            <UBadge
              v-if="cardToKeep === 'card1'"
              color="success"
              label="Keep"
              size="xs"
            />
            <UBadge
              v-else
              color="error"
              label="Delete"
              variant="subtle"
              size="xs"
            />
          </div>

          <div
            class="rounded-lg p-4 min-h-28 flex items-center justify-center text-center font-semibold"
            :class="
              cardType === 'black'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-900'
            "
          >
            {{ currentPair.card1.text }}
          </div>

          <div class="mt-3 space-y-1 text-xs text-slate-500">
            <div>
              <span class="text-slate-400">Pack:</span>
              {{ currentPair.card1.pack }}
            </div>
            <div>
              <span class="text-slate-400">ID:</span>
              <code class="text-xs">{{ currentPair.card1.$id }}</code>
            </div>
            <div>
              <span class="text-slate-400">Status:</span>
              <UBadge
                :color="currentPair.card1.active ? 'success' : 'error'"
                :label="currentPair.card1.active ? 'Active' : 'Inactive'"
                variant="subtle"
                size="xs"
                class="ml-1"
              />
            </div>
          </div>
        </div>

        <!-- Card 2 -->
        <div
          class="rounded-xl border-2 p-4 cursor-pointer transition-all"
          :class="
            cardToKeep === 'card2'
              ? 'border-green-400 bg-green-400/5 shadow-[0_0_20px_rgba(74,222,128,0.15)]'
              : 'border-slate-700 hover:border-slate-500'
          "
          @click="cardToKeep = 'card2'"
        >
          <div class="flex items-center justify-between mb-3">
            <span
              class="text-xs font-bold uppercase tracking-wider text-slate-400"
              >Card 2</span
            >
            <UBadge
              v-if="cardToKeep === 'card2'"
              color="success"
              label="Keep"
              size="xs"
            />
            <UBadge
              v-else
              color="error"
              label="Delete"
              variant="subtle"
              size="xs"
            />
          </div>

          <div
            class="rounded-lg p-4 min-h-28 flex items-center justify-center text-center font-semibold"
            :class="
              cardType === 'black'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-900'
            "
          >
            {{ currentPair.card2.text }}
          </div>

          <div class="mt-3 space-y-1 text-xs text-slate-500">
            <div>
              <span class="text-slate-400">Pack:</span>
              {{ currentPair.card2.pack }}
            </div>
            <div>
              <span class="text-slate-400">ID:</span>
              <code class="text-xs">{{ currentPair.card2.$id }}</code>
            </div>
            <div>
              <span class="text-slate-400">Status:</span>
              <UBadge
                :color="currentPair.card2.active ? 'success' : 'error'"
                :label="currentPair.card2.active ? 'Active' : 'Inactive'"
                variant="subtle"
                size="xs"
                class="ml-1"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex justify-center gap-3 pt-2">
        <UButton
          size="lg"
          color="error"
          :loading="deletingPair"
          icon="i-solar-trash-bin-trash-bold-duotone"
          @click="keepCard"
        >
          Delete {{ cardToKeep === "card1" ? "Card 2" : "Card 1" }}, Keep
          {{ cardToKeep === "card1" ? "Card 1" : "Card 2" }}
        </UButton>
        <UButton
          size="lg"
          variant="ghost"
          color="neutral"
          icon="i-solar-alt-arrow-right-linear"
          trailing
          :disabled="currentPairIndex >= allSimilarPairs.length - 1"
          @click="skipPair"
        >
          Skip this pair
        </UButton>
      </div>
    </div>
  </div>
</template>
