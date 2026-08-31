<template>
  <main class="labs-page">
    <div class="labs-page__grid" aria-hidden="true" />
    <div class="labs-shell">
      <section class="labs-hero">
        <div class="labs-hero__copy">
          <div class="labs-chip labs-chip--lime">
            <Icon name="solar:test-tube-bold-duotone" /> Community R&amp;D
          </div>
          <p class="labs-eyebrow">Peer review for bad taste</p>
          <h1>UNFIT <span>LABS</span></h1>
          <p class="labs-hero__description">
            Submit cards, vote on what’s funny, and help the worst ideas make it
            into the deck.
          </p>
          <div class="labs-hero__actions">
            <UButton
              class="labs-primary-action"
              icon="i-solar-add-circle-bold-duotone"
              @click="submitCardOpen = true"
              >Submit a card</UButton
            >
            <a class="labs-secondary-action" href="#submissions"
              ><Icon name="solar:card-send-bold-duotone" /> Browse
              submissions</a
            >
          </div>
        </div>
        <div class="labs-hero__stats">
          <div class="labs-stat">
            <span>Submissions</span
            ><strong class="labs-stat--cyan">{{ submissions.length }}</strong>
          </div>
          <div class="labs-stat">
            <span>Votes cast</span
            ><strong class="labs-stat--yellow">{{ totalVotes }}</strong>
          </div>
        </div>
      </section>

      <section id="submissions" class="labs-content">
        <div class="labs-tabs">
          <div class="labs-tab labs-tab--active">
            <Icon name="solar:test-tube-bold-duotone" /> Submissions
            <span>{{ submissions.length }}</span>
          </div>
        </div>
        <div class="labs-feed-heading">
          <div>
            <p class="labs-eyebrow">Experiment queue</p>
            <h2>Community submissions</h2>
          </div>
          <p>{{ filteredSubmissions.length }} cards · {{ sortLabel }}</p>
        </div>
        <div class="labs-controls">
          <div class="labs-filter-group" aria-label="Card type filters">
            <button
              :class="{ active: filters.cardType === 'all' }"
              @click="filters.cardType = 'all'"
            >
              All
            </button>
            <button
              :class="{ active: filters.cardType === 'white' }"
              @click="filters.cardType = 'white'"
            >
              Answers
            </button>
            <button
              :class="{ active: filters.cardType === 'black' }"
              @click="filters.cardType = 'black'"
            >
              Prompts
            </button>
          </div>
          <ClientOnly
            ><UInput
              v-model="filters.search"
              class="labs-search"
              icon="i-solar-minimalistic-magnifer-bold-duotone"
              placeholder="Search experiments"
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
            <p>Loading experiments…</p>
          </div>
          <div v-else-if="submissions.length === 0" class="labs-state">
            <Icon name="solar:test-tube-bold-duotone" />
            <h3>Nothing in the lab yet</h3>
            <p>Be the first to submit a card.</p>
            <UButton @click="submitCardOpen = true">Submit a card</UButton>
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
      </section>
    </div>
    <UModal
      v-model:open="submitCardOpen"
      title="Submit a card"
      description="Add your latest experiment to the community queue."
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
useHead({ title: "Unfit Labs" });
const submitCardOpen = ref(false);
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
const sortOptions = [
  { label: "Newest first", value: "timestamp" },
  { label: "Most upvoted", value: "upvotes" },
  { label: "Shortest text", value: "textLength" },
];
const perPageOptions = [
  { label: "12 per page", value: 12 },
  { label: "24 per page", value: 24 },
  { label: "48 per page", value: 48 },
];
const totalVotes = computed(() =>
  submissions.value.reduce(
    (sum, submission) => sum + (submission.upvotes || 0),
    0,
  ),
);
const sortLabel = computed(
  () =>
    sortOptions
      .find((option) => option.value === filters.value.sortBy)
      ?.label.toLowerCase() || "newest first",
);
const filteredSubmissions = computed(() => {
  const search = filters.value.search.trim().toLowerCase();

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

  return [...submissions.value]
    .filter(
      (submission) =>
        (filters.value.cardType === "all" ||
          submission.cardType === filters.value.cardType) &&
        (!search ||
          submission.text.toLowerCase().includes(search) ||
          submission.submitterName.toLowerCase().includes(search)),
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
      title: "Couldn’t load submissions",
      description: "Try refreshing the page.",
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
    useToast().add({ title: "Couldn’t update vote", color: "error" });
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
    useToast().add({ title: "Couldn’t delete submission", color: "error" });
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
    useToast().add({ title: "Couldn’t adopt submission", color: "error" });
  }
}
onMounted(fetchSubmissions);
</script>

<style>
.labs-page {
  position: relative;
  min-height: 100vh;
  isolation: isolate;
  background: #05060d;
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
    linear-gradient(180deg, #05060d, #090d1a 50%, #05060d);
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
  color: #f6f3ea;
  border-bottom: 3px solid #a9ed87;
  font-family: "Archivo Black", sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
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
