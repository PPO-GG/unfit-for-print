<script setup lang="ts">
import { useCardSearch } from "~/composables/useCardSearch";
import { useCardSimilarity } from "~/composables/useCardSimilarity";
import { useNotifications } from "~/composables/useNotifications";
import { keeperReasons, suggestKeeper } from "~/utils/duplicateKeeper";
import {
  canApplyDecision,
  clusterKey,
  defaultDisableSelection,
  isPending,
  keptCards,
  nextPendingIndex,
  pendingCount,
  pruneDisabledCards,
} from "~/utils/duplicateQueue";

definePageMeta({ middleware: "admin" });

const { $activityFetch } = useNuxtApp();
const { notify } = useNotifications();
const { cardType } = useCardSearch();

const {
  processingAllSimilarCards,
  duplicateClusters,
  similarityThreshold,
  scanProgress,
  findAllSimilarCards,
} = useCardSimilarity();

const allCards = ref<any[]>([]);
const defaultPacks = ref<string[]>([]);
const loadingCards = ref(false);
const includeDisabled = ref(false);
/** Off = compare every card against every other; on = only within a pack. */
const samePackOnly = ref(false);
const currentIndex = ref(0);
/** Cards in the current group marked to be disabled. Everything else is kept. */
const disableIds = ref(new Set<string>());
const disabling = ref(false);
/** Groups already dealt with, by stable key — see ~/utils/duplicateQueue. */
const resolvedKeys = ref(new Set<string>());

const currentCluster = computed(() => {
  const cluster = duplicateClusters.value[currentIndex.value];
  return cluster && isPending(cluster, resolvedKeys.value) ? cluster : null;
});
const totalClusters = computed(() => duplicateClusters.value.length);
const remainingClusters = computed(() =>
  pendingCount(duplicateClusters.value, resolvedKeys.value),
);
const resolvedCount = computed(
  () => totalClusters.value - remainingClusters.value,
);
const flaggedCardCount = computed(() =>
  duplicateClusters.value.reduce(
    (n, c) => (isPending(c, resolvedKeys.value) ? n + c.cards.length : n),
    0,
  ),
);
/** True once every group has a decision — nothing left to navigate to. */
const reviewComplete = computed(
  () => totalClusters.value > 0 && remainingClusters.value === 0,
);
const canNavigate = computed(() => remainingClusters.value > 1);

/** The cluster's cards, strongest suggestion first. */
const clusterCards = computed(() => {
  const cluster = currentCluster.value;
  if (!cluster) return [];
  const suggested = suggestKeeper(cluster.cards, {
    defaultPacks: defaultPacks.value,
  });
  return [
    suggested,
    ...cluster.cards.filter((card: any) => card.id !== suggested.id),
  ];
});

const suggestedId = computed(() => clusterCards.value[0]?.id ?? null);
const suggestedReasons = computed(() =>
  clusterCards.value[0]
    ? keeperReasons(clusterCards.value[0], { defaultPacks: defaultPacks.value })
    : [],
);
const doomedCards = computed(() =>
  clusterCards.value.filter((card: any) => disableIds.value.has(card.id)),
);
const keptCount = computed(() =>
  currentCluster.value ? keptCards(currentCluster.value, disableIds.value).length : 0,
);
/** Keeping everything is a valid outcome: similar, but both worth having. */
const keepingAll = computed(
  () => !!currentCluster.value && doomedCards.value.length === 0,
);
const decisionAllowed = computed(
  () => !!currentCluster.value && canApplyDecision(currentCluster.value, disableIds.value),
);

const toggleCard = (id: string) => {
  const next = new Set(disableIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  disableIds.value = next;
};

/** Highest similarity recorded between the keeper and anything else in the group. */
const similarityFor = (id: string) => {
  const cluster = currentCluster.value;
  if (!cluster) return 0;
  const scores = cluster.pairs
    .filter((p: any) => p.a === id || p.b === id)
    .map((p: any) => p.similarity);
  return scores.length ? Math.round(Math.max(...scores) * 100) : 0;
};

// If the group in view stops needing review — pruned to a single card by
// another group's resolution — move to one that does rather than rendering an
// empty review pane.
watch([duplicateClusters, resolvedKeys, currentIndex], () => {
  const cluster = duplicateClusters.value[currentIndex.value];
  if (cluster && isPending(cluster, resolvedKeys.value)) return;
  if (remainingClusters.value === 0) return;
  const next = nextPendingIndex(
    duplicateClusters.value,
    resolvedKeys.value,
    currentIndex.value,
    1,
  );
  if (next !== -1) currentIndex.value = next;
});

// Reset the selection whenever the cluster under review changes, so the
// suggestion is always what's pre-selected rather than a stale choice.
watch(
  [currentIndex, duplicateClusters],
  () => {
    disableIds.value = currentCluster.value
      ? defaultDisableSelection(currentCluster.value, suggestedId.value)
      : new Set();
  },
  { immediate: true },
);

const loadCards = async () => {
  loadingCards.value = true;
  allCards.value = [];
  try {
    const [cards, packs] = await Promise.all([
      $activityFetch<any[]>("/api/admin/cards/list", {
        query: {
          type: cardType.value,
          ...(includeDisabled.value ? {} : { active: "true" }),
        },
      }),
      $activityFetch<{ packs: string[] }>("/api/admin/cards/default-packs"),
    ]);
    allCards.value = cards;
    defaultPacks.value = packs.packs ?? [];
  } catch (err) {
    console.error("Failed to load cards:", err);
    notify({ title: "Failed to load cards", color: "error" });
  } finally {
    loadingCards.value = false;
  }
};

const runScan = async () => {
  currentIndex.value = 0;
  resolvedKeys.value = new Set();
  await findAllSimilarCards(
    allCards.value,
    cardType.value,
    samePackOnly.value,
  );
};

/** Resolve the current group: disable what's marked, keep the rest. */
const applyDecision = async () => {
  const cluster = currentCluster.value;
  if (!cluster || !decisionAllowed.value) return;

  const ids = doomedCards.value.map((card: any) => card.id);

  // Keeping everything is a decision too — record it and move on without
  // touching the database.
  if (ids.length === 0) {
    resolvedKeys.value = new Set(resolvedKeys.value).add(clusterKey(cluster));
    const next = nextPendingIndex(
      duplicateClusters.value,
      resolvedKeys.value,
      currentIndex.value,
      1,
    );
    if (next !== -1) currentIndex.value = next;
    notify({
      title: "Left as-is",
      description: `All ${cluster.cards.length} cards kept.`,
      color: "info",
    });
    return;
  }

  disabling.value = true;
  try {
    await $activityFetch("/api/admin/cards/set-active", {
      method: "POST",
      body: { ids, type: cardType.value, active: false },
    });

    const disabled = new Set(ids);
    // Reflect the change locally rather than refetching: a disabled card is
    // out of the running, so it should not anchor any remaining cluster.
    if (includeDisabled.value) {
      allCards.value = allCards.value.map((card) =>
        disabled.has(card.id) ? { ...card, active: false } : card,
      );
    } else {
      allCards.value = allCards.value.filter((card) => !disabled.has(card.id));
    }

    // Mark this group done before pruning, so its key still matches its cards.
    resolvedKeys.value = new Set(resolvedKeys.value).add(clusterKey(cluster));
    // The list keeps its length; entries are never removed mid-review, so the
    // index can't slide backwards onto a group that was already skipped.
    duplicateClusters.value = pruneDisabledCards(
      duplicateClusters.value,
      disabled,
    );

    const next = nextPendingIndex(
      duplicateClusters.value,
      resolvedKeys.value,
      currentIndex.value,
      1,
    );
    if (next !== -1) currentIndex.value = next;

    notify({
      title: `${ids.length} card${ids.length === 1 ? "" : "s"} disabled`,
      description: "They stay in the database and can be re-enabled any time.",
      color: "success",
    });
  } catch (err) {
    console.error("Failed to disable cards:", err);
    notify({ title: "Disable failed", color: "error" });
  } finally {
    disabling.value = false;
  }
};

const step = (direction: 1 | -1) => {
  const next = nextPendingIndex(
    duplicateClusters.value,
    resolvedKeys.value,
    currentIndex.value,
    direction,
  );
  if (next !== -1) currentIndex.value = next;
};

// Both wrap, so the last group is never a dead end.
const skipCluster = () => step(1);
const prevCluster = () => step(-1);

const switchType = (type: "black" | "white") => {
  if (cardType.value === type) return;
  cardType.value = type;
};

watch(samePackOnly, () => {
  duplicateClusters.value = [];
  resolvedKeys.value = new Set();
  currentIndex.value = 0;
});

watch([cardType, includeDisabled], () => {
  allCards.value = [];
  duplicateClusters.value = [];
  resolvedKeys.value = new Set();
  currentIndex.value = 0;
  loadCards();
});

onMounted(() => loadCards());
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-8">
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
          Group near-duplicate cards and disable the copies you don't want
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
              @click="switchType('black')"
            >
              🖤 Black
            </button>
            <button
              class="px-4 py-2 text-sm font-semibold transition-colors"
              :class="
                cardType === 'white'
                  ? 'bg-slate-200 text-slate-900'
                  : 'bg-slate-700/40 text-slate-400 hover:text-white'
              "
              @click="switchType('white')"
            >
              🤍 White
            </button>
          </div>
        </div>

        <!-- Pack scope -->
        <div class="flex flex-col gap-1">
          <label
            class="text-xs font-semibold uppercase tracking-wider text-slate-400"
            >Compare</label
          >
          <div
            class="flex rounded-lg overflow-hidden border border-slate-600/50"
          >
            <button
              class="px-4 py-2 text-sm font-semibold transition-colors"
              :class="
                !samePackOnly
                  ? 'bg-slate-600 text-white'
                  : 'bg-slate-700/40 text-slate-400 hover:text-white'
              "
              @click="samePackOnly = false"
            >
              Across all packs
            </button>
            <button
              class="px-4 py-2 text-sm font-semibold transition-colors"
              :class="
                samePackOnly
                  ? 'bg-slate-600 text-white'
                  : 'bg-slate-700/40 text-slate-400 hover:text-white'
              "
              @click="samePackOnly = true"
            >
              Same pack only
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
            Reload
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

      <div class="mt-4 flex items-center gap-3">
        <USwitch v-model="includeDisabled" />
        <div class="text-sm">
          <span class="text-slate-300">Include already-disabled cards</span>
          <span class="text-slate-500">
            — off by default, so duplicates you've resolved stay resolved
          </span>
        </div>
      </div>

      <!-- Loading indicator -->
      <div
        v-if="loadingCards"
        class="mt-4 flex items-center gap-2 text-sm text-slate-400"
      >
        <UIcon name="i-solar-loading-bold-duotone" class="animate-spin" />
        Loading cards...
      </div>
    </UCard>

    <!-- No scan run yet -->
    <div
      v-if="duplicateClusters.length === 0 && !processingAllSimilarCards"
      class="flex flex-col items-center justify-center py-24 text-center"
    >
      <UIcon
        name="i-solar-copy-bold-duotone"
        class="text-7xl text-slate-700 mb-6"
      />
      <p class="text-slate-400 text-lg font-medium">No scan results yet</p>
      <p class="text-slate-500 text-sm mt-1 mb-6">
        Load cards and click "Scan" to group duplicate or near-duplicate cards
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

      <div class="w-full mb-3">
        <UProgress
          :value="Math.round(scanProgress * 100)"
          :max="100"
          color="primary"
          size="md"
        />
      </div>
      <p class="text-xs text-slate-500">
        {{ Math.round(scanProgress * 100) }}% complete
      </p>
    </div>

    <!-- Every group reviewed -->
    <div
      v-else-if="reviewComplete"
      class="flex flex-col items-center justify-center py-24 text-center"
    >
      <UIcon
        name="i-solar-check-circle-bold-duotone"
        class="text-7xl text-green-400 mb-6"
      />
      <p class="text-slate-300 text-xl font-semibold">All groups reviewed</p>
      <p class="text-slate-500 text-sm mt-1 mb-6">
        {{ resolvedCount }} of {{ totalClusters }} groups resolved. Scan again
        to pick up anything the disabled cards were hiding.
      </p>
      <UButton
        color="warning"
        icon="i-solar-copy-bold-duotone"
        :loading="processingAllSimilarCards"
        @click="runScan"
      >
        Re-scan
      </UButton>
    </div>

    <!-- Done — nothing found -->
    <div
      v-else-if="duplicateClusters.length === 0"
      class="flex flex-col items-center justify-center py-24 text-center"
    >
      <UIcon
        name="i-solar-check-circle-bold-duotone"
        class="text-7xl text-green-400 mb-6"
      />
      <p class="text-slate-300 text-xl font-semibold">All clear!</p>
      <p class="text-slate-500 text-sm mt-1">
        No cards were similar enough to flag above the
        {{ Math.round(similarityThreshold * 100) }}% threshold{{
          samePackOnly ? ", comparing within each pack" : ""
        }}
      </p>
    </div>

    <!-- Cluster review -->
    <div v-else class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <p class="text-lg font-semibold">
            {{ remainingClusters }} group{{ remainingClusters === 1 ? "" : "s" }}
            left to review
          </p>
          <p class="text-sm text-slate-400">
            {{ resolvedCount }} of {{ totalClusters }} resolved, covering
            {{ flaggedCardCount }} cards still flagged. Click a card to toggle
            keep or disable.
          </p>
        </div>
        <div class="flex gap-2">
          <UButton
            size="sm"
            variant="ghost"
            color="neutral"
            icon="i-solar-alt-arrow-left-linear"
            :disabled="!canNavigate"
            @click="prevCluster"
          >
            Prev
          </UButton>
          <UButton
            size="sm"
            variant="ghost"
            color="neutral"
            icon="i-solar-alt-arrow-right-linear"
            trailing
            :disabled="!canNavigate"
            @click="skipCluster"
          >
            Skip
          </UButton>
        </div>
      </div>

      <UProgress
        :value="resolvedCount"
        :max="totalClusters"
        color="warning"
        size="xs"
      />

      <div class="flex justify-center">
        <UBadge
          :color="
            (currentCluster?.topSimilarity ?? 0) >= 0.95
              ? 'error'
              : (currentCluster?.topSimilarity ?? 0) >= 0.8
                ? 'warning'
                : 'info'
          "
          size="lg"
          :label="`${clusterCards.length} cards, up to ${Math.round((currentCluster?.topSimilarity ?? 0) * 100)}% alike`"
        />
      </div>

      <!-- Cards in this group -->
      <div class="grid gap-4 sm:grid-cols-2">
        <div
          v-for="card in clusterCards"
          :key="card.id"
          class="rounded-xl border-2 p-4 cursor-pointer transition-all"
          :class="
            disableIds.has(card.id)
              ? 'border-slate-700 bg-slate-900/40 opacity-60 hover:border-slate-500'
              : 'border-green-400 bg-green-400/5 shadow-[0_0_20px_rgba(74,222,128,0.15)]'
          "
          @click="toggleCard(card.id)"
        >
          <div class="flex items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2">
              <UBadge
                v-if="!disableIds.has(card.id)"
                color="success"
                label="Keep"
                size="xs"
              />
              <UBadge
                v-else
                color="warning"
                label="Disable"
                variant="subtle"
                size="xs"
              />
              <UBadge
                v-if="card.id === suggestedId"
                color="primary"
                variant="subtle"
                label="Suggested"
                size="xs"
              />
            </div>
            <span class="text-xs text-slate-500">
              {{ similarityFor(card.id) }}% match
            </span>
          </div>

          <div
            class="rounded-lg p-4 min-h-28 flex items-center justify-center text-center font-semibold"
            :class="
              cardType === 'black'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-900'
            "
          >
            {{ card.text }}
          </div>

          <div class="mt-3 space-y-1 text-xs text-slate-500">
            <div>
              <span class="text-slate-400">Pack:</span>
              {{ card.pack || "—" }}
              <UBadge
                v-if="card.pack && defaultPacks.includes(card.pack)"
                color="primary"
                variant="subtle"
                label="Default"
                size="xs"
                class="ml-1"
              />
            </div>
            <div v-if="cardType === 'black'">
              <span class="text-slate-400">Pick:</span> {{ card.pick }}
            </div>
            <div>
              <span class="text-slate-400">ID:</span>
              <code class="text-xs">{{ card.id }}</code>
            </div>
            <div>
              <span class="text-slate-400">Status:</span>
              <UBadge
                :color="card.active ? 'success' : 'neutral'"
                :label="card.active ? 'Enabled' : 'Disabled'"
                variant="subtle"
                size="xs"
                class="ml-1"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- A group has to keep at least one card -->
      <p
        v-if="!decisionAllowed"
        class="text-center text-xs text-amber-400"
      >
        Keep at least one card — disabling every copy would remove it from the
        game entirely.
      </p>

      <!-- Why this one was suggested -->
      <p
        v-if="suggestedReasons.length && !disableIds.has(suggestedId ?? '')"
        class="text-center text-xs text-slate-500"
      >
        Suggested because:
        {{ suggestedReasons.map((r) => r.label.toLowerCase()).join(", ") }}
      </p>

      <!-- Action buttons -->
      <div class="flex flex-wrap justify-center gap-3 pt-2">
        <UButton
          size="lg"
          :color="keepingAll ? 'primary' : 'warning'"
          :loading="disabling"
          :disabled="!decisionAllowed"
          :icon="
            keepingAll
              ? 'i-solar-check-circle-bold-duotone'
              : 'i-solar-eye-closed-bold-duotone'
          "
          @click="applyDecision"
        >
          <template v-if="keepingAll">
            Not duplicates — keep all {{ clusterCards.length }}
          </template>
          <template v-else>
            Disable {{ doomedCards.length }}, keep {{ keptCount }}
          </template>
        </UButton>
        <UButton
          size="lg"
          variant="ghost"
          color="neutral"
          icon="i-solar-alt-arrow-right-linear"
          trailing
          :disabled="!canNavigate"
          @click="skipCluster"
        >
          Skip this group
        </UButton>
      </div>

      <p class="text-center text-xs text-slate-600">
        Disabled cards stay in the database and can be re-enabled from the Card
        Manager.
      </p>
    </div>
  </div>
</template>
