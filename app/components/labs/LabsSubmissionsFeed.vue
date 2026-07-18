<!--
  Labs submissions feed with the Hot/New/Top/Graduated/Mine filter
  bar. `Hot` and `New` are derived from the real submissions stream;
  `Graduated` is always empty today (schema has no graduation state);
  `Mine` filters to the current user.
-->
<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="sub-tabs">
        <button
          v-for="f in FILTERS"
          :key="f.id"
          type="button"
          class="sub-tab"
          :class="{ active: filter === f.id }"
          @click="filter = f.id"
        >
          <LabsIcon :name="f.icon" :size="11" />
          {{ f.label }}
        </button>
      </div>
      <div
        class="font-mono uppercase"
        :style="{
          fontSize: '10px',
          letterSpacing: '0.2em',
          color: 'var(--ink-muted)',
        }"
      >
        {{ list.length }} cards · sort by upvotes
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon
        name="i-svg-spinners-ring-resize"
        class="text-3xl"
        :style="{ color: 'var(--accent-lime)' }"
      />
    </div>

    <div v-else-if="list.length === 0" class="labs-panel p-12 text-center">
      <div
        class="font-display uppercase mb-2"
        :style="{ fontSize: '22px', color: 'var(--ink-dim)' }"
      >
        Nothing here yet
      </div>
      <div
        class="font-cond"
        :style="{ fontSize: '15px', color: 'var(--ink-muted)' }"
      >
        {{ emptyHelper }}
      </div>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <LabsSubmissionCard
        v-for="sub in list"
        :key="sub.id"
        :sub="sub"
        :logged-in="loggedIn"
        :current-user-id="currentUserId"
        :admin="admin"
        :upvoting="upvoteInFlight === sub.id"
        @upvote="onUpvote"
        @delete="(id) => emit('delete', id)"
        @adopt="(s) => emit('adopt', s)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  LabsSubmission,
  SubmissionFeedFilter,
} from "~/types/labs";

const props = defineProps<{
  submissions: LabsSubmission[];
  loading: boolean;
  loggedIn: boolean;
  currentUserId?: string | null;
  currentUserName?: string | null;
  admin?: boolean;
  upvoteInFlight?: string | null;
}>();

const emit = defineEmits<{
  upvote: [id: string];
  delete: [id: string];
  adopt: [sub: LabsSubmission];
}>();

const FILTERS: { id: SubmissionFeedFilter; label: string; icon: "flame" | "new" | "chart" | "grad-cap" | "user" }[] = [
  { id: "hot", label: "Hot", icon: "flame" },
  { id: "new", label: "New", icon: "new" },
  { id: "top", label: "Top", icon: "chart" },
  { id: "graduated", label: "Graduated", icon: "grad-cap" },
  { id: "mine", label: "Mine", icon: "user" },
];

const filter = ref<SubmissionFeedFilter>("hot");

const list = computed<LabsSubmission[]>(() => {
  const subs = props.submissions;
  switch (filter.value) {
    case "hot":
      return subs.filter((s) => s.trend === "hot");
    case "new":
      return subs.filter((s) => s.status === "new");
    case "top":
      return [...subs].sort((a, b) => b.up - a.up).slice(0, 12);
    case "graduated":
      return subs.filter((s) => s.status === "graduated");
    case "mine": {
      const name = props.currentUserName?.toUpperCase() ?? null;
      if (!name) return [];
      return subs.filter((s) => s.author === name);
    }
    default:
      return subs;
  }
});

const emptyHelper = computed(() => {
  switch (filter.value) {
    case "hot":
      return "No cards are trending right now. Check back soon.";
    case "graduated":
      return "Graduation pipeline is coming — no cards have graduated yet.";
    case "mine":
      return "Submit a card to see it here.";
    default:
      return "Be the first to submit a card to this feed.";
  }
});

function onUpvote(id: string) {
  emit("upvote", id);
}
</script>
