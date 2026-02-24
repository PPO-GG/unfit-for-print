<template>
  <div class="max-w-[1100px] mx-auto px-4 pt-6 pb-12 flex flex-col gap-5">
    <!-- ═══════════════════════════════════════ -->
    <!-- HERO SECTION                           -->
    <!-- ═══════════════════════════════════════ -->
    <div class="labs-hero backdrop-blur-md">
      <div class="hero-glow" />
      <div class="relative z-[1]">
        <div class="flex items-center justify-center gap-3 mb-3">
          <Icon
            name="solar:test-tube-bold-duotone"
            class="text-[2.5rem] text-violet-600 dark:text-violet-400 drop-shadow-[0_0_12px_rgba(139,92,246,0.35)] dark:drop-shadow-[0_0_12px_rgba(139,92,246,0.5)]"
          />
        </div>
        <h1
          class="text-5xl tracking-[0.2em] text-indigo-950 dark:text-slate-100 leading-tight mb-1 dark:drop-shadow-[0_0_30px_rgba(139,92,246,0.5)] max-sm:text-3xl max-sm:tracking-[0.14em]"
        >
          UNFIT LABS
        </h1>
        <p
          class="text-base tracking-[0.12em] text-gray-500 dark:text-slate-400"
        >
          Community Experiments in Bad Taste
        </p>
        <div class="hero-divider" />
        <div
          class="flex justify-center gap-8 max-sm:flex-col max-sm:gap-2 max-sm:items-center"
        >
          <div class="stat-chip">
            <Icon
              name="solar:card-bold-duotone"
              class="text-base text-violet-600 dark:text-violet-400"
            />
            <span
              class="text-xl text-indigo-950 dark:text-slate-100 tracking-wide"
              >{{ submissions.length }}</span
            >
            <span
              class="text-[0.65rem] tracking-[0.15em] text-gray-500 dark:text-slate-500"
              >SUBMISSIONS</span
            >
          </div>
          <div class="stat-chip">
            <Icon
              name="solar:like-bold-duotone"
              class="text-base text-violet-600 dark:text-violet-400"
            />
            <span
              class="text-xl text-indigo-950 dark:text-slate-100 tracking-wide"
              >{{ totalVotes }}</span
            >
            <span
              class="text-[0.65rem] tracking-[0.15em] text-gray-500 dark:text-slate-500"
              >VOTES CAST</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════ -->
    <!-- SUBMIT A CARD WIDGET                   -->
    <!-- ═══════════════════════════════════════ -->
    <div class="w-full">
      <div class="labs-widget backdrop-blur-md">
        <button
          class="flex items-center justify-between w-full bg-transparent border-none py-1 cursor-pointer text-inherit"
          @click="submitCardOpen = !submitCardOpen"
        >
          <div class="widget-label">
            <Icon
              name="solar:magic-stick-3-bold-duotone"
              class="text-base text-violet-600 dark:text-violet-500"
            />
            <span>SUBMIT YOUR EXPERIMENT</span>
          </div>
          <Icon
            name="solar:alt-arrow-down-bold-duotone"
            class="text-xl text-violet-600 dark:text-violet-500 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
            :class="{ 'rotate-180': submitCardOpen }"
          />
        </button>
        <Transition name="slide-expand">
          <div v-if="submitCardOpen" class="overflow-hidden">
            <div class="hero-divider" />
            <ClientOnly>
              <CardSubmissionForm @card-submitted="handleCardSubmitted" />
            </ClientOnly>
          </div>
        </Transition>
      </div>
    </div>

    <!-- ═══════════════════════════════════════ -->
    <!-- FILTER BAR                             -->
    <!-- ═══════════════════════════════════════ -->
    <div class="w-full">
      <div class="labs-widget flex flex-col gap-3 backdrop-blur-md">
        <div class="widget-label">
          <Icon
            name="solar:tuning-2-bold-duotone"
            class="text-base text-violet-600 dark:text-violet-500"
          />
          <span>FILTERS</span>
        </div>
        <ClientOnly>
          <div class="flex flex-wrap gap-2 items-center max-sm:flex-col">
            <USelect
              v-model="filters.cardType"
              :items="cardTypeOptions"
              class="min-w-[140px] shrink-0 max-sm:w-full max-sm:min-w-0"
              placeholder="Card Type"
            />
            <USelect
              v-model="filters.sortBy"
              :items="sortOptions"
              class="min-w-[140px] shrink-0 max-sm:w-full max-sm:min-w-0"
              placeholder="Sort By"
            />
            <USelect
              v-model="filters.sortDirection"
              :items="sortDirectionOptions"
              class="min-w-[140px] shrink-0 max-sm:w-full max-sm:min-w-0"
              placeholder="Sort Direction"
            />
            <UInput
              v-model="filters.search"
              class="flex-1 min-w-[180px] max-sm:w-full max-sm:min-w-0"
              icon="i-solar-minimalistic-magnifer-bold-duotone"
              placeholder="Search experiments…"
            />
          </div>
        </ClientOnly>
      </div>
    </div>

    <!-- ═══════════════════════════════════════ -->
    <!-- SUBMISSIONS GRID                       -->
    <!-- ═══════════════════════════════════════ -->
    <div class="w-full backdrop-blur-md">
      <ClientOnly>
        <!-- Loading -->
        <div
          v-if="loading"
          class="flex flex-col items-center justify-center py-16 gap-4"
        >
          <Icon
            name="solar:loading-bold-duotone"
            class="animate-spin text-[2.5rem] text-violet-500"
          />
          <span
            class="text-base tracking-wide text-gray-500 dark:text-slate-400"
            >Loading experiments…</span
          >
        </div>

        <!-- Empty State -->
        <div v-else-if="submissions.length === 0" class="labs-empty">
          <div
            class="w-20 h-20 flex items-center justify-center rounded-full bg-violet-500/12 dark:bg-violet-500/10 border border-violet-500/25 mb-5"
          >
            <Icon
              name="solar:test-tube-bold-duotone"
              class="text-[2.5rem] text-violet-600 drop-shadow-[0_0_10px_rgba(139,92,246,0.4)]"
            />
          </div>
          <h3
            class="text-2xl tracking-wide text-indigo-950 dark:text-slate-200 mb-1"
          >
            No Experiments Yet
          </h3>
          <p
            class="text-[0.95rem] text-gray-500 dark:text-slate-500 tracking-wider mb-6"
          >
            Be the first to submit a card to the Unfit Labs.
          </p>
          <UButton
            class="text-lg tracking-wide"
            color="primary"
            icon="i-solar-magic-stick-3-bold-duotone"
            variant="soft"
            @click="submitCardOpen = true"
          >
            Submit Your First Card
          </UButton>
        </div>

        <!-- Cards -->
        <template v-else>
          <SubmissionsList
            :submissions="paginatedSubmissions"
            @delete="handleDelete"
            @upvote="handleUpvote"
            @adopt="handleAdopt"
          />

          <!-- Pagination -->
          <div class="flex flex-wrap items-center justify-between gap-4 py-6">
            <USelect
              v-model="pagination.perPage"
              :items="perPageOptions"
              class="w-[140px] max-sm:w-full"
            />
            <UPagination
              v-model="pagination.page"
              color="primary"
              variant="subtle"
              :page-count="pageCount"
              :total="filteredSubmissions.length"
            />
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useUserStore } from "~/stores/userStore";
import { isAuthenticatedUser } from "~/composables/useUserUtils";
import { useIsAdmin } from "~/composables/useAdminCheck";
import { Query } from "appwrite";
import { watchDebounced } from "@vueuse/core";

useHead({ title: "Unfit Labs" });

// User authentication
const submitCardOpen = ref(false);
const userStore = useUserStore();
const isLoggedIn = computed(() => isAuthenticatedUser(userStore.user));
const isAdmin = useIsAdmin();

// Appwrite
import { getAppwrite } from "~/utils/appwrite";
const { client, tables } = getAppwrite();
const config = useRuntimeConfig();

// State
const submissions = ref<any[]>([]);
const loading = ref(true);
const lastLoadedId = ref<string | null>(null);
const hasMoreSubmissions = ref(true);
const upvoteInProgress = ref(false);

// Computed stats
const totalVotes = computed(() =>
  submissions.value.reduce((sum, s) => sum + (s.upvotes || 0), 0),
);

// Filters and sorting
const filters = ref({
  cardType: "all",
  sortBy: "timestamp",
  sortDirection: "desc",
  search: "",
});

watchDebounced(
  () => filters.value.search,
  () => {
    pagination.value.page = 1;
  },
  { debounce: 500, maxWait: 1000 },
);

const cardTypeOptions = [
  { label: "All Cards", value: "all" },
  { label: "White Cards", value: "white" },
  { label: "Black Cards", value: "black" },
];

const sortOptions = [
  { label: "Submission Date", value: "timestamp" },
  { label: "Most Upvotes", value: "upvotes" },
  { label: "Text Length", value: "textLength" },
  { label: "Number of Picks", value: "pick" },
];

const sortDirectionOptions = [
  { label: "Descending", value: "desc" },
  { label: "Ascending", value: "asc" },
];

// Pagination
const pagination = ref({
  page: 1,
  perPage: 10,
});

const perPageOptions = [
  { label: "10 per page", value: 10 },
  { label: "25 per page", value: 25 },
  { label: "50 per page", value: 50 },
  { label: "100 per page", value: 100 },
];

// Computed properties
const filteredSubmissions = computed(() => {
  let result = [...submissions.value];

  if (filters.value.cardType !== "all") {
    result = result.filter(
      (submission) => submission.cardType === filters.value.cardType,
    );
  }

  if (filters.value.search) {
    const searchTerm = filters.value.search.toLowerCase();
    result = result.filter(
      (submission) =>
        submission.text.toLowerCase().includes(searchTerm) ||
        submission.submitterName.toLowerCase().includes(searchTerm),
    );
  }

  result.sort((a, b) => {
    let valueA, valueB;

    switch (filters.value.sortBy) {
      case "timestamp":
        valueA = new Date(a.timestamp).getTime();
        valueB = new Date(b.timestamp).getTime();
        break;
      case "upvotes":
        valueA = a.upvotes;
        valueB = b.upvotes;
        break;
      case "textLength":
        valueA = a.text.length;
        valueB = b.text.length;
        break;
      case "pick":
        valueA = a.pick || 1;
        valueB = b.pick || 1;
        break;
      default:
        valueA = new Date(a.timestamp).getTime();
        valueB = new Date(b.timestamp).getTime();
    }

    return filters.value.sortDirection === "asc"
      ? valueA - valueB
      : valueB - valueA;
  });

  return result;
});

const pageCount = computed(() => {
  return Math.ceil(filteredSubmissions.value.length / pagination.value.perPage);
});

const paginatedSubmissions = computed(() => {
  const start = (pagination.value.page - 1) * pagination.value.perPage;
  const end = start + pagination.value.perPage;
  return filteredSubmissions.value.slice(start, end);
});

// Methods
async function fetchSubmissions() {
  if (!tables) return;

  try {
    loading.value = true;

    const response = await tables.listRows({
      databaseId: config.public.appwriteDatabaseId,
      tableId: config.public.appwriteSubmissionCollectionId,
      queries: [
        lastLoadedId.value
          ? Query.cursorAfter(lastLoadedId.value)
          : Query.orderDesc("$createdAt"),
        Query.limit(50),
      ],
    });

    if (response.rows.length < 50) {
      hasMoreSubmissions.value = false;
    }

    if (response.rows.length > 0) {
      lastLoadedId.value = response.rows[response.rows.length - 1]!.$id;
      submissions.value = [...submissions.value, ...response.rows];
    }
  } catch (error) {
    console.error("Error fetching submissions:", error);
    useToast().add({
      title: "Error",
      description: "Failed to load submissions",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}

async function loadMoreSubmissions() {
  if (hasMoreSubmissions.value && !loading.value) {
    await fetchSubmissions();
  }
}

async function handleUpvote(submissionId: string) {
  if (!isLoggedIn.value || upvoteInProgress.value) return;

  try {
    upvoteInProgress.value = true;

    const submissionIndex = submissions.value.findIndex(
      (s) => s.$id === submissionId,
    );
    if (submissionIndex === -1) return;

    const submission = submissions.value[submissionIndex];
    const userId = userStore.user?.$id;
    if (!userId) return;

    const upvoterIds = submission.upvoterIds || [];
    const alreadyUpvoted = upvoterIds.includes(userId);

    if (alreadyUpvoted) {
      submissions.value[submissionIndex] = await tables.updateRow({
        databaseId: config.public.appwriteDatabaseId,
        tableId: config.public.appwriteSubmissionCollectionId,
        rowId: submissionId,
        data: {
          upvotes: submission.upvotes - 1,
          upvoterIds: upvoterIds.filter((id: string) => id !== userId),
        },
      });
    } else {
      submissions.value[submissionIndex] = await tables.updateRow({
        databaseId: config.public.appwriteDatabaseId,
        tableId: config.public.appwriteSubmissionCollectionId,
        rowId: submissionId,
        data: {
          upvotes: submission.upvotes + 1,
          upvoterIds: [...upvoterIds, userId],
        },
      });
    }
  } catch (error) {
    console.error("Error upvoting submission:", error);
    useToast().add({
      title: "Error",
      description: "Failed to update vote",
      color: "error",
    });
  } finally {
    upvoteInProgress.value = false;
  }
}

function handleCardSubmitted(newSubmission: any) {
  submissions.value.unshift(newSubmission);
  pagination.value.page = 1;
  useToast().add({
    title: "Experiment Submitted",
    description: "Your card has been submitted to the lab!",
    color: "success",
  });
}

async function handleDelete(submissionId: string) {
  if (!isAdmin.value) {
    useToast().add({
      title: "Error",
      description: "Only administrators can delete submissions",
      color: "error",
    });
    return;
  }

  try {
    await tables.deleteRow({
      databaseId: config.public.appwriteDatabaseId,
      tableId: config.public.appwriteSubmissionCollectionId,
      rowId: submissionId,
    });
    submissions.value = submissions.value.filter((s) => s.$id !== submissionId);
    useToast().add({
      title: "Success",
      description: "Submission deleted successfully",
      color: "success",
    });
  } catch (error) {
    console.error("Error deleting submission:", error);
    useToast().add({
      title: "Error",
      description: "Failed to delete submission",
      color: "error",
    });
  }
}

async function handleAdopt(submission: any) {
  if (!isAdmin.value) {
    useToast().add({
      title: "Error",
      description: "Only administrators can adopt submissions",
      color: "error",
    });
    return;
  }

  try {
    const collectionId =
      submission.cardType === "white"
        ? config.public.appwriteWhiteCardCollectionId
        : config.public.appwriteBlackCardCollectionId;

    const cardData: any = {
      text: submission.text,
      pack: "Unfit Labs",
      active: true,
      submittedBy: submission.submitterName,
    };

    if (submission.cardType === "black" && submission.pick) {
      cardData.pick = submission.pick;
    }

    await tables.createRow({
      databaseId: config.public.appwriteDatabaseId,
      tableId: collectionId,
      rowId: "unique()",
      data: cardData,
    });

    await tables.deleteRow({
      databaseId: config.public.appwriteDatabaseId,
      tableId: config.public.appwriteSubmissionCollectionId,
      rowId: submission.$id,
    });

    submissions.value = submissions.value.filter(
      (s) => s.$id !== submission.$id,
    );

    useToast().add({
      title: "Adopted!",
      description: "Card successfully adopted to the Unfit Labs pack!",
      color: "success",
    });
  } catch (error) {
    console.error("Error adopting submission:", error);
    useToast().add({
      title: "Error",
      description: "Failed to adopt submission",
      color: "error",
    });
  }
}

// Real-time subscription
function subscribeToSubmissions() {
  if (!client) return;

  const dbId = config.public.appwriteDatabaseId;
  const collectionId = config.public.appwriteSubmissionCollectionId;

  return client.subscribe(
    [`databases.${dbId}.collections.${collectionId}.rows`],
    (response: any) => {
      const { events, payload } = response;

      if (events.some((e: string) => e.endsWith(".create"))) {
        if (!submissions.value.some((s) => s.$id === payload.$id)) {
          submissions.value.unshift(payload);
        }
      }

      if (events.some((e: string) => e.endsWith(".update"))) {
        const index = submissions.value.findIndex((s) => s.$id === payload.$id);
        if (index !== -1) {
          submissions.value[index] = payload;
        }
      }

      if (events.some((e: string) => e.endsWith(".delete"))) {
        submissions.value = submissions.value.filter(
          (s) => s.$id !== payload.$id,
        );
      }
    },
  );
}

let unsubscribe: (() => void) | undefined;
onMounted(async () => {
  await fetchSubmissions();
  unsubscribe = subscribeToSubmissions();
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});

watch([() => filters.value.cardType, () => filters.value.search], () => {
  pagination.value.page = 1;
});
</script>

<style>
/* ─── Hero Container (complex gradient + multi-value box-shadow) ── */
.labs-hero {
  position: relative;
  background: linear-gradient(135deg, #ede9fe, #ddd6fe);
  border: 1px solid rgba(139, 92, 246, 0.4);
  border-radius: 1rem;
  padding: 2.5rem 2rem;
  text-align: center;
  overflow: hidden;
  box-shadow:
    0 4px 24px rgba(139, 92, 246, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}
.dark .labs-hero {
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.14),
    rgba(15, 23, 42, 0.92)
  );
  box-shadow:
    0 0 40px rgba(139, 92, 246, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* ─── Hero Glow Orb ──────────────────────────────────── */
.hero-glow {
  position: absolute;
  top: -60%;
  left: 50%;
  transform: translateX(-50%);
  width: 400px;
  height: 400px;
  background: radial-gradient(
    circle,
    rgba(139, 92, 246, 0.12) 0%,
    transparent 70%
  );
  pointer-events: none;
}
.dark .hero-glow {
  background: radial-gradient(
    circle,
    rgba(139, 92, 246, 0.18) 0%,
    transparent 70%
  );
}

/* ─── Gradient Divider ───────────────────────────────── */
.hero-divider {
  height: 1px;
  max-width: 320px;
  margin: 1.5rem auto;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(139, 92, 246, 0.4),
    transparent
  );
}

/* ─── Stat Chip Pill ─────────────────────────────────── */
.stat-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 99px;
  padding: 0.4rem 1rem;
}
.dark .stat-chip {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.2);
}

/* ─── Widget Base (complex gradient + multi-value box-shadow) ── */
.labs-widget {
  background: linear-gradient(135deg, #f5f3ff, #ede9fe);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 0.875rem;
  padding: 1rem;
  box-shadow:
    0 2px 12px rgba(139, 92, 246, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
.dark .labs-widget {
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.1),
    rgba(15, 23, 42, 0.9)
  );
  box-shadow:
    0 0 20px rgba(139, 92, 246, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

/* ─── Widget Label ───────────────────────────────────── */
.widget-label {
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.dark .widget-label {
  color: #94a3b8;
}

/* ─── Empty State (complex gradient) ─────────────────── */
.labs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  background: linear-gradient(135deg, #f5f3ff, #ede9fe);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 0.875rem;
  text-align: center;
}
.dark .labs-empty {
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.06),
    rgba(15, 23, 42, 0.7)
  );
  border-color: rgba(139, 92, 246, 0.2);
}

/* ─── Slide Expand Transition ────────────────────────── */
.slide-expand-enter-active,
.slide-expand-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 800px;
  opacity: 1;
}
.slide-expand-enter-from,
.slide-expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
