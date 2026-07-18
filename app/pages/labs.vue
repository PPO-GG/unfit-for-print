<!--
  Labs — ported from the Claude Design prototype.

  Layout:
    1. Hero (title + stats + CTAs)
    2. Head-to-head voting arena (stubbed pair picker)
    3. Main tabs: Submissions / Card Packs / Leaderboards

  Current wiring:
    - Submissions feed: REAL (Appwrite `submission` collection +
      upvote toggle + admin delete/adopt + realtime subscription).
    - Hero stats totalSubmissions / votesCast: REAL (derived).
    - Hero stats inPlaytest / graduated / thisWeek: MOCK.
    - Head-to-head voting: STUBBED (random pair from real submissions,
      local-only winner tracking — no persistence).
    - Card packs: MOCK (no pack-metadata collection yet).
    - Leaderboards: MOCK (no contributor rollups yet).
    - Submit modal: REAL (wraps existing CardSubmissionForm).

  Full stub → real swap plan in
  `docs/ui-overhaul-future-features.md` → Labs section.
-->
<template>
  <div class="relative z-10">
    <BrandTopBar />

    <div class="ufp-labs">
      <div class="ufp-labs-bg" aria-hidden="true" />
      <div class="max-w-[1400px] mx-auto px-6 py-6 flex flex-col gap-6 relative">
        <!-- Breadcrumb -->
        <div
          class="font-mono uppercase flex items-center"
          :style="{
            fontSize: '11px',
            letterSpacing: '0.15em',
            color: 'var(--ink-muted)',
          }"
        >
          <NuxtLink
            to="/"
            class="hover:text-white"
            :style="{ color: 'var(--ink-dim)' }"
          >
            ARCADE
          </NuxtLink>
          <span
            class="mx-2 opacity-60"
            :style="{ color: 'var(--ink-muted)' }"
          >/</span>
          <span :style="{ color: 'var(--ink)' }">LABS</span>
        </div>

        <!-- Hero -->
        <LabsHero
          :stats="stats"
          @submit="submitOpen = true"
          @start-voting="scrollToH2H"
        />

        <!-- Head-to-head arena -->
        <LabsH2HArena ref="h2hArena" :submissions="submissions" />

        <!-- Main tabs -->
        <div class="labs-tabs">
          <button
            type="button"
            class="labs-tab"
            :class="{ active: tab === 'feed' }"
            @click="tab = 'feed'"
          >
            <LabsIcon name="beaker" :size="14" /> Submissions
            <span class="count">{{ stats.totalSubmissions.toLocaleString() }}</span>
          </button>
          <button
            type="button"
            class="labs-tab"
            :class="{ active: tab === 'packs' }"
            @click="tab = 'packs'"
          >
            <LabsIcon name="grid" :size="14" /> Card Packs
            <span class="count">{{ packs.length }}</span>
          </button>
          <button
            type="button"
            class="labs-tab"
            :class="{ active: tab === 'leaderboard' }"
            @click="tab = 'leaderboard'"
          >
            <LabsIcon name="chart" :size="14" /> Leaderboards
          </button>
        </div>

        <!-- Tab content -->
        <div :key="tab" class="fade-in">
          <LabsSubmissionsFeed
            v-if="tab === 'feed'"
            :submissions="submissions"
            :loading="loading"
            :logged-in="isLoggedIn"
            :current-user-id="currentUserId"
            :current-user-name="currentUserName"
            :admin="isAdmin"
            :upvote-in-flight="upvoteInFlight"
            @upvote="upvote"
            @delete="adminDelete"
            @adopt="adminAdopt"
          />
          <LabsPackBrowser
            v-else-if="tab === 'packs'"
            :packs="packs"
            :pack-cards="packCards"
            :loading="packsLoading"
            :loading-cards-for="packCardsLoadingFor"
            @select-pack="onSelectPack"
          />
          <LabsLeaderboards
            v-else-if="tab === 'leaderboard'"
            :contributors="contributors"
            :submissions="submissions"
          />
        </div>
      </div>
    </div>

    <!-- Submit modal -->
    <LabsSubmitModal
      :open="submitOpen"
      @close="submitOpen = false"
      @submitted="onSubmitted"
    />
  </div>
</template>

<script setup lang="ts">
import type { LabsPack } from "~/types/labs";
import { LABS_CONTRIBUTORS_MOCK } from "~/composables/useLabsMockData";

definePageMeta({ layout: "default" });
useHead({ title: "Unfit Labs" });

// ─── User ─────────────────────────────────────────────────────────────────
const userStore = useUserStore();
const currentUserId = computed(() => userStore.user?.$id ?? null);
const currentUserName = computed(() => userStore.user?.name ?? null);

// ─── Submissions (real Appwrite stream) ──────────────────────────────────
const {
  submissions,
  loading,
  isLoggedIn,
  isAdmin,
  upvoteInFlight,
  upvote,
  adminDelete,
  adminAdopt,
  prependNew,
} = useLabsSubmissions();

// ─── Derived stats ────────────────────────────────────────────────────────
const { stats } = useLabsStats(submissions);

// ─── Packs (real Appwrite data, lazy-loaded when tab opens) ───────────────
const {
  packs,
  packCards,
  loading: packsLoading,
  loadingCardsFor: packCardsLoadingFor,
  loadPacks,
  loadPackCards,
} = useLabsPacks();

// ─── Contributors (still stubbed — no rollup system yet) ──────────────────
const contributors = LABS_CONTRIBUTORS_MOCK;

// ─── UI state ─────────────────────────────────────────────────────────────
const tab = ref<"feed" | "packs" | "leaderboard">("feed");
const submitOpen = ref(false);

// Lazy-load the pack list the first time the user opens the tab.
watch(
  tab,
  (t) => {
    if (t === "packs" && packs.value.length === 0) void loadPacks();
  },
  { immediate: false },
);

function onSelectPack(pack: LabsPack) {
  void loadPackCards(pack.name);
}

const h2hArena = ref<{ scrollIntoView: () => void } | null>(null);
function scrollToH2H() {
  h2hArena.value?.scrollIntoView();
}

function onSubmitted(newRow: Record<string, unknown>) {
  prependNew(newRow);
  useToast().add({
    title: "Experiment Submitted",
    description: "Your card is in the playtest queue.",
    color: "success",
  });
}
</script>
