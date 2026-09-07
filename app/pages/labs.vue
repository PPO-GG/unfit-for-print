<template>
  <main class="labs-page">
    <div class="labs-page__grid" aria-hidden="true" />
    <div class="labs-shell">
      <section class="labs-hero">
        <div class="labs-hero__copy">
          <div class="labs-chip labs-chip--lime">
            <Icon name="solar:test-tube-bold-duotone" /> {{ t("labs.chip") }}
          </div>
          <p class="labs-eyebrow">{{ t("labs.eyebrow") }}</p>
          <h1>UNFIT <span>LABS</span></h1>
          <p class="labs-hero__description">{{ t("labs.description") }}</p>
          <div class="labs-hero__actions">
            <UButton
              class="labs-primary-action"
              icon="i-solar-add-circle-bold-duotone"
              @click="submitCardOpen = true"
              >{{ t("labs.submit_card") }}</UButton
            >
            <a
              class="labs-secondary-action"
              href="#submissions"
              @click="activeTab = 'submissions'"
              ><Icon name="solar:card-send-bold-duotone" />
              {{ t("labs.browse_submissions") }}</a
            >
            <a
              class="labs-secondary-action"
              href="#submissions"
              @click="activeTab = 'packs'"
              ><Icon name="solar:cardholder-bold-duotone" />
              {{ t("labs.browse_packs") }}</a
            >
          </div>
        </div>
        <div class="labs-hero__stats">
          <div class="labs-stat">
            <span>{{ t("labs.stat_submissions") }}</span
            ><strong class="labs-stat--cyan">{{ submissions.length }}</strong>
          </div>
          <div class="labs-stat">
            <span>{{ t("labs.stat_votes") }}</span
            ><strong class="labs-stat--yellow">{{ totalVotes }}</strong>
          </div>
          <div class="labs-stat labs-stat--wide">
            <span>{{ t("labs.stat_cards") }}</span
            ><strong class="labs-stat--lime-lg">{{
              packsLoading ? "—" : labsCards.toLocaleString()
            }}</strong>
          </div>
        </div>
      </section>

      <section id="submissions" class="labs-content">
        <div class="labs-tabs">
          <button
            class="labs-tab"
            :class="{ 'labs-tab--active': activeTab === 'submissions' }"
            type="button"
            @click="activeTab = 'submissions'"
          >
            <Icon
              class="labs-tab__icon"
              name="solar:test-tube-bold-duotone"
            /> {{ t("labs.tab_submissions") }}
            <span>{{ submissions.length }}</span>
          </button>
          <button
            class="labs-tab"
            :class="{ 'labs-tab--active': activeTab === 'packs' }"
            type="button"
            @click="activeTab = 'packs'"
          >
            <Icon
              class="labs-tab__icon"
              name="solar:cardholder-bold-duotone"
            /> {{ t("labs.tab_packs") }}
            <span v-if="!packsLoading">{{ packCount }}</span>
          </button>
        </div>

        <ClientOnly v-if="activeTab === 'packs'">
          <LabsCardPackBrowser />
        </ClientOnly>

        <template v-else>
        <div class="labs-feed-heading">
          <div>
            <p class="labs-eyebrow">{{ t("labs.queue_eyebrow") }}</p>
            <h2>{{ t("labs.queue_title") }}</h2>
          </div>
          <p>{{ t("labs.queue_summary", { count: filteredSubmissions.length, sort: sortLabel }) }}</p>
        </div>
        <div class="labs-controls">
          <div class="labs-filter-group" :aria-label="t('labs.queue_title')">
            <button
              :class="{ active: filters.cardType === 'all' }"
              @click="filters.cardType = 'all'"
            >
              {{ t("labs.filter_all") }}
              <span>{{ typeCounts.all }}</span>
            </button>
            <button
              :class="{ active: filters.cardType === 'white' }"
              @click="filters.cardType = 'white'"
            >
              {{ t("labs.filter_answers") }}
              <span>{{ typeCounts.white }}</span>
            </button>
            <button
              :class="{ active: filters.cardType === 'black' }"
              @click="filters.cardType = 'black'"
            >
              {{ t("labs.filter_prompts") }}
              <span>{{ typeCounts.black }}</span>
            </button>
          </div>
          <ClientOnly
            ><UInput
              v-model="filters.search"
              class="labs-search"
              icon="i-solar-minimalistic-magnifer-bold-duotone"
              :placeholder="t('labs.search_experiments')"
          /></ClientOnly>
          <ClientOnly
            ><USelect
              v-model="filters.sortBy"
              :items="sortOptions"
              class="labs-select"
          /></ClientOnly>
        </div>
        <ClientOnly>
          <div v-if="loading" class="labs-state">
            <Icon name="solar:loading-bold-duotone" class="animate-spin" />
            <p>{{ t("labs.loading_experiments") }}</p>
          </div>
          <div v-else-if="submissions.length === 0" class="labs-state">
            <Icon name="solar:test-tube-bold-duotone" />
            <h3>{{ t("labs.empty_title") }}</h3>
            <p>{{ t("labs.empty_body") }}</p>
            <UButton @click="submitCardOpen = true">{{ t("labs.submit_card") }}</UButton>
          </div>
          <template v-else>
            <SubmissionsList
              :submissions="paginatedSubmissions"
              @delete="handleDelete"
              @upvote="handleUpvote"
              @adopt="handleAdopt"
            />
            <div class="labs-pagination">
              <USelect
                v-model="pagination.perPage"
                :items="perPageOptions"
              /><UPagination
                v-model="pagination.page"
                :page-count="pageCount"
                :total="filteredSubmissions.length"
              />
            </div>
          </template>
        </ClientOnly>
        </template>
      </section>
    </div>
    <UModal
      v-model:open="submitCardOpen"
      :title="t('labs.submit_card')"
      :description="t('labs.submit_modal_description')"
      :ui="{ content: 'labs-submit-modal' }"
    >
      <template #body
        ><ClientOnly
          ><CardSubmissionForm
            @card-submitted="handleCardSubmitted" /></ClientOnly
      ></template>
    </UModal>
  </main>
</template>

<script lang="ts" setup>
import { watchDebounced } from "@vueuse/core";
import { useIsAdmin } from "~/composables/useAdminCheck";
import { isAuthenticatedUser } from "~/composables/useUserUtils";
import { useUserStore } from "~/stores/userStore";
const { t } = useI18n();
useHead({ title: "Unfit Labs" });
const submitCardOpen = ref(false);
const activeTab = ref<"submissions" | "packs">("submissions");
// Loaded up front so the hero's card count is right before anyone opens the
// Card Packs tab; CardPackBrowser shares this same roster.
const {
  labsCards,
  packCount,
  loading: packsLoading,
  load: loadCardPacks,
} = useCardPacks();
const userStore = useUserStore();
const isLoggedIn = computed(() => isAuthenticatedUser(userStore.user));
const isAdmin = useIsAdmin();
const { $activityFetch } = useNuxtApp();
const submissions = ref<any[]>([]);
const loading = ref(true);
const upvoteInProgress = ref(false);
const filters = ref({
  cardType: "all",
  sortBy: "timestamp",
  sortDirection: "desc",
  search: "",
});
const pagination = ref({ page: 1, perPage: 12 });
const sortOptions = computed(() => [
  { label: t("labs.sort_newest"), value: "timestamp" },
  { label: t("labs.sort_upvotes"), value: "upvotes" },
  { label: t("labs.sort_shortest"), value: "textLength" },
]);
const perPageOptions = computed(() =>
  [12, 24, 48].map((count) => ({
    label: t("labs.per_page", { count }),
    value: count,
  })),
);
const totalVotes = computed(() =>
  submissions.value.reduce(
    (sum, submission) => sum + (submission.upvotes || 0),
    0,
  ),
);
const sortLabel = computed(
  () =>
    sortOptions.value
      .find((option) => option.value === filters.value.sortBy)
      ?.label.toLowerCase() || t("labs.sort_newest").toLowerCase(),
);
// The card-type buttons each carry a count of what selecting them would show,
// so the search runs on its own first and the type filter is applied on top.
const searchedSubmissions = computed(() => {
  const search = filters.value.search.trim().toLowerCase();
  if (!search) return submissions.value;
  return submissions.value.filter(
    (submission) =>
      submission.text.toLowerCase().includes(search) ||
      submission.submitterName.toLowerCase().includes(search),
  );
});

const typeCounts = computed(() => ({
  all: searchedSubmissions.value.length,
  white: searchedSubmissions.value.filter((s) => s.cardType === "white").length,
  black: searchedSubmissions.value.filter((s) => s.cardType === "black").length,
}));

const filteredSubmissions = computed(() => {
  const getSortValue = (item: any, sortBy: string): number => {
    switch (sortBy) {
      case "upvotes":
        return item.upvotes || 0;
      case "textLength":
        return item.text?.length || 0;
      case "timestamp":
      default:
        return new Date(item.createdAt || item.timestamp).getTime();
    }
  };

  return [...searchedSubmissions.value]
    .filter(
      (submission) =>
        filters.value.cardType === "all" ||
        submission.cardType === filters.value.cardType,
    )
    .sort((a, b) => {
      const valueA = getSortValue(a, filters.value.sortBy);
      const valueB = getSortValue(b, filters.value.sortBy);
      return filters.value.sortDirection === "asc"
        ? valueA - valueB
        : valueB - valueA;
    });
});
const pageCount = computed(() =>
  Math.max(
    1,
    Math.ceil(filteredSubmissions.value.length / pagination.value.perPage),
  ),
);
const paginatedSubmissions = computed(() =>
  filteredSubmissions.value.slice(
    (pagination.value.page - 1) * pagination.value.perPage,
    pagination.value.page * pagination.value.perPage,
  ),
);
watchDebounced(
  () => filters.value.search,
  () => {
    pagination.value.page = 1;
  },
  { debounce: 300, maxWait: 700 },
);
watch(
  [
    () => filters.value.cardType,
    () => filters.value.sortBy,
    () => pagination.value.perPage,
  ],
  () => {
    pagination.value.page = 1;
  },
);
async function fetchSubmissions() {
  try {
    loading.value = true;
    submissions.value = await $activityFetch<any[]>("/api/submissions/list", {
      query: { limit: 50 },
    });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    useToast().add({
      title: t("labs.error_submissions"),
      description: t("labs.error_refresh"),
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}
async function handleUpvote(submissionId: string) {
  if (!isLoggedIn.value || upvoteInProgress.value) return;
  try {
    upvoteInProgress.value = true;
    const index = submissions.value.findIndex(
      (submission) => submission.id === submissionId,
    );
    if (index < 0) return;
    submissions.value[index] = await $activityFetch("/api/submissions/upvote", {
      method: "POST",
      body: { submissionId },
    });
  } catch (error) {
    console.error("Error upvoting submission:", error);
    useToast().add({ title: t("labs.error_vote"), color: "error" });
  } finally {
    upvoteInProgress.value = false;
  }
}
function handleCardSubmitted(submission: any) {
  submissions.value.unshift(submission);
  pagination.value.page = 1;
  submitCardOpen.value = false;
}
async function handleDelete(submissionId: string) {
  if (!isAdmin.value) return;
  try {
    await $activityFetch("/api/admin/submissions/delete", {
      method: "POST",
      body: { submissionId },
    });
    submissions.value = submissions.value.filter(
      (submission) => submission.id !== submissionId,
    );
  } catch (error) {
    console.error("Error deleting submission:", error);
    useToast().add({ title: t("labs.error_delete"), color: "error" });
  }
}
async function handleAdopt(submission: any) {
  if (!isAdmin.value) return;
  try {
    await $activityFetch("/api/submissions/adopt", {
      method: "POST",
      body: { submissionId: submission.id },
    });
    submissions.value = submissions.value.filter(
      (item) => item.id !== submission.id,
    );
  } catch (error) {
    console.error("Error adopting submission:", error);
    useToast().add({ title: t("labs.error_adopt"), color: "error" });
  }
}
onMounted(() => {
  fetchSubmissions();
  loadCardPacks();
});
</script>

<style>
.labs-page {
  position: relative;
  min-height: 100vh;
  /* Deliberately no background colour: the opaque #05060d that used to be here
     painted over the layout's ScrollingBackground. The tinted glows in
     .labs-page__grid are translucent for the same reason, so the scrolling
     cards read through them while the text stays legible. */
  color: #f6f3ea;
  font-family: "Barlow Condensed", system-ui, sans-serif;
  overflow: hidden;
}
.labs-page__grid {
  position: fixed;
  z-index: -1;
  inset: 0;
  background:
    radial-gradient(
      850px 450px at 70% -10%,
      rgba(140, 220, 120, 0.12),
      transparent 60%
    ),
    radial-gradient(
      700px 500px at 0 60%,
      rgba(120, 220, 255, 0.07),
      transparent 65%
    ),
    linear-gradient(
      180deg,
      rgba(5, 6, 13, 0.5),
      rgba(9, 13, 26, 0.62) 50%,
      rgba(5, 6, 13, 0.5)
    );
}
.labs-page__grid:after {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(
      0deg,
      transparent 0 37px,
      rgba(255, 255, 255, 0.025) 38px 39px
    ),
    repeating-linear-gradient(
      90deg,
      transparent 0 37px,
      rgba(255, 255, 255, 0.025) 38px 39px
    );
  mask-image: radial-gradient(ellipse at 50% 25%, black, transparent 80%);
}
.labs-shell {
  max-width: 1600px;
  margin: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
.labs-hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(140, 220, 120, 0.3);
  border-radius: 18px;
  padding: 2rem;
  background: linear-gradient(
    135deg,
    rgba(140, 220, 120, 0.13),
    rgba(120, 220, 255, 0.06) 45%,
    rgba(10, 13, 28, 0.85)
  );
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.7fr);
  gap: 2rem;
}
.labs-eyebrow {
  margin: 0 0 0.3rem;
  color: #8891b4;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.61rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}
.labs-chip {
  width: max-content;
  display: flex;
  gap: 0.35rem;
  align-items: center;
  border: 1px solid;
  border-radius: 999px;
  padding: 0.32rem 0.6rem;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.61rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.labs-chip--lime {
  color: #a9ed87;
  border-color: rgba(140, 220, 120, 0.5);
  background: rgba(140, 220, 120, 0.12);
}
.labs-hero h1,
.labs-feed-heading h2 {
  margin: 0.4rem 0;
  font-family: "Archivo Black", sans-serif;
  text-transform: uppercase;
}
.labs-hero h1 {
  font-size: clamp(3.2rem, 7vw, 5.7rem);
  line-height: 0.88;
}
.labs-hero h1 span {
  color: #a9ed87;
}
.labs-hero__description {
  max-width: 590px;
  margin: 0;
  color: #b9c0d9;
  font-size: 1.25rem;
  line-height: 1.2;
}
.labs-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
}
.labs-primary-action {
  background: #a9ed87 !important;
  border-color: #a9ed87 !important;
  color: #09220e !important;
  font-family: "Archivo Black", sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.labs-secondary-action {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid rgba(255, 255, 255, 0.17);
  border-radius: 8px;
  padding: 0.55rem 0.9rem;
  color: #e5e8f1;
  font-family: "Archivo Black", sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.labs-hero__stats {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  align-content: center;
}
.labs-stat {
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(5, 6, 13, 0.28);
}
.labs-stat--wide {
  grid-column: span 2;
}
.labs-stat span {
  display: block;
  color: #8891b4;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.58rem;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
.labs-stat strong {
  display: block;
  margin-top: 0.2rem;
  font-family: "Archivo Black", sans-serif;
  font-size: 1.65rem;
}
.labs-stat--cyan {
  color: #8ee6ff;
}
.labs-stat--yellow {
  color: #ffe16d;
}
.labs-stat--lime {
  color: #a9ed87 !important;
  font-size: 0.78rem !important;
}
.labs-stat--lime-lg {
  color: #a9ed87;
}
.labs-stat strong i {
  display: inline-block;
  width: 0.45rem;
  height: 0.45rem;
  margin-right: 0.35rem;
  border-radius: 50%;
  background: #a9ed87;
  box-shadow: 0 0 12px #a9ed87;
}
.labs-beaker {
  position: absolute;
  right: 1rem;
  bottom: -7rem;
  width: 16rem;
  height: 16rem;
  border: 3px solid rgba(169, 237, 135, 0.5);
  border-top: 0;
  clip-path: polygon(
    28% 0,
    72% 0,
    72% 22%,
    95% 88%,
    89% 100%,
    11% 100%,
    5% 88%,
    28% 22%
  );
  opacity: 0.35;
  pointer-events: none;
}
.labs-beaker__neck {
  position: absolute;
  top: 10%;
  left: 28%;
  right: 28%;
  height: 1px;
  background: #a9ed87;
}
.labs-beaker__liquid {
  position: absolute;
  bottom: 0;
  left: 9%;
  right: 9%;
  height: 37%;
  background: linear-gradient(#b3ff87aa, #74c95ddd);
  clip-path: polygon(10% 0, 90% 0, 100% 100%, 0 100%);
}
.labs-beaker__liquid i {
  position: absolute;
  border-radius: 50%;
  background: #ecffd8;
}
.labs-beaker__liquid i:nth-child(1) {
  width: 9px;
  height: 9px;
  left: 30%;
  top: 30%;
}
.labs-beaker__liquid i:nth-child(2) {
  width: 6px;
  height: 6px;
  right: 28%;
  top: 55%;
}
.labs-beaker__liquid i:nth-child(3) {
  width: 4px;
  height: 4px;
  left: 55%;
  top: 10%;
}
.labs-content {
  position: relative;
}
.labs-tabs {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.labs-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.85rem 1rem;
  border: 0;
  border-bottom: 3px solid transparent;
  background: none;
  color: #8891b4;
  cursor: pointer;
  font-family: "Archivo Black", sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  transition:
    color 0.18s ease,
    border-color 0.18s ease;
}
.labs-tab__icon {
  flex: 0 0 1.35rem;
  width: 1.35rem;
  height: 1.35rem;
  font-size: 1.35rem;
}
.labs-tab:hover {
  color: #d7dcec;
}
.labs-tab--active {
  color: #f6f3ea;
  border-bottom-color: #a9ed87;
}
.labs-tab span {
  padding: 0.12rem 0.4rem;
  border-radius: 999px;
  background: rgba(140, 220, 120, 0.17);
  color: #a9ed87;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
}
.labs-feed-heading {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: end;
  margin: 1.5rem 0 1rem;
}
.labs-feed-heading h2 {
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  line-height: 1;
}
.labs-feed-heading > p {
  margin: 0;
  color: #8891b4;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.63rem;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.labs-controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}
.labs-filter-group {
  display: flex;
  gap: 0.35rem;
  padding: 0.2rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.025);
}
.labs-filter-group button {
  border: 0;
  border-radius: 5px;
  padding: 0.45rem 0.65rem;
  background: transparent;
  color: #8891b4;
  cursor: pointer;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.labs-filter-group button.active {
  background: #a9ed87;
  color: #09220e;
  font-weight: 800;
}
/* Count badge inside a filter button. Styled here rather than in
   CardPackBrowser because .labs-filter-group itself lives in this unscoped
   block and both consumers render the same markup. */
.labs-filter-group button span {
  margin-left: 0.4rem;
  border-radius: 999px;
  padding: 0.05rem 0.32rem;
  background: rgba(255, 255, 255, 0.08);
  color: #b6bed8;
  font-size: 0.58rem;
  font-variant-numeric: tabular-nums;
}
.labs-filter-group button.active span {
  background: rgba(9, 34, 14, 0.16);
  color: #09220e;
}
.labs-search {
  min-width: 220px;
  flex: 1;
}
.labs-select {
  width: 170px;
}
.labs-state {
  min-height: 310px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 14px;
  color: #8891b4;
  text-align: center;
}
.labs-state svg {
  font-size: 2.4rem;
  color: #a9ed87;
}
.labs-state h3 {
  margin: 0;
  color: #f6f3ea;
  font-family: "Archivo Black", sans-serif;
  text-transform: uppercase;
}
.labs-state p {
  margin: 0;
}
.labs-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: 1.25rem;
}
.labs-pagination > :first-child {
  width: 130px;
}
.labs-submit-modal {
  background: #0a0d1c !important;
  border: 1px solid rgba(169, 237, 135, 0.35) !important;
  color: #f6f3ea !important;
}
@media (max-width: 800px) {
  .labs-shell {
    padding: 1rem;
  }
  .labs-hero {
    grid-template-columns: 1fr;
    padding: 1.5rem;
  }
  .labs-beaker {
    display: none;
  }
  .labs-hero__stats {
    max-width: 500px;
  }
  .labs-feed-heading {
    align-items: start;
    flex-direction: column;
  }
  .labs-pagination {
    align-items: stretch;
    flex-direction: column;
  }
  .labs-pagination > :first-child {
    width: 100%;
  }
}
@media (max-width: 500px) {
  .labs-hero__stats {
    grid-template-columns: 1fr;
  }
  .labs-stat--wide {
    grid-column: auto;
  }
  .labs-search,
  .labs-select {
    width: 100%;
    min-width: 0;
  }
  .labs-filter-group {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
