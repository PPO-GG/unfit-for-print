<script lang="ts" setup>
import { FEEDBACK_TOPICS, FEEDBACK_TOPIC_LABELS, type FeedbackTopic } from "#shared/feedback";

const PAGE_SIZE = 20;
/**
 * Reka UI's Select reserves "" for clearing the selection and throws on an
 * item with that value, so "All" carries a sentinel. It must never reach the
 * API: /api/admin/feedback 400s on an unknown rating or topic. Mapping it to
 * undefined makes useFetch omit the parameter, which the route reads as "no
 * filter" (same approach as IssueInbox).
 */
const ALL = "all";

const ratingFilter = ref<string>(ALL);
const topicFilter = ref<string>(ALL);
const withMessage = ref(true);
const page = ref(1);

watch([ratingFilter, topicFilter, withMessage], () => {
  page.value = 1;
});

const query = computed(() => ({
  rating: ratingFilter.value === ALL ? undefined : ratingFilter.value,
  topic: topicFilter.value === ALL ? undefined : topicFilter.value,
  withMessage: String(withMessage.value),
  page: page.value,
  pageSize: PAGE_SIZE,
}));

const { data, error } = await useFetch("/api/admin/feedback", { query });

const ratingItems = [
  { label: "All ratings", value: ALL },
  ...[5, 4, 3, 2, 1].map((r) => ({ label: `${r}★`, value: String(r) })),
];
const topicItems = [
  { label: "All topics", value: ALL },
  ...FEEDBACK_TOPICS.map((tp) => ({ label: FEEDBACK_TOPIC_LABELS[tp], value: tp })),
];

const delta = computed(() => {
  const s = data.value?.summary;
  return s && s.avgRating30d !== null && s.avgRatingPrev30d !== null
    ? s.avgRating30d - s.avgRatingPrev30d
    : null;
});
const distMax = computed(() =>
  data.value ? Math.max(1, ...Object.values(data.value.distribution)) : 1,
);

function barPct(v: number, max: number): number {
  if (v <= 0) return 0;
  return Math.max(4, Math.round((v / max) * 100));
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="error" class="text-red-400 text-sm">Couldn't load feedback: {{ error.message }}</div>

    <template v-if="data">
      <!-- Stat tiles -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <UCard>
          <p class="text-xs uppercase tracking-wider text-slate-500">Avg rating · 30d</p>
          <p class="text-3xl font-bold mt-1">
            {{ data.summary.avgRating30d?.toFixed(2) ?? "—" }}
            <span class="text-amber-400 text-xl">★</span>
          </p>
          <p v-if="delta !== null" class="text-xs mt-1" :class="delta >= 0 ? 'text-emerald-400' : 'text-red-400'">
            {{ delta >= 0 ? "▲" : "▼" }} {{ Math.abs(delta).toFixed(2) }} vs prior 30d
          </p>
        </UCard>
        <UCard>
          <p class="text-xs uppercase tracking-wider text-slate-500">Ratings · 30d</p>
          <p class="text-3xl font-bold mt-1">{{ data.summary.ratings30d }}</p>
        </UCard>
        <UCard>
          <p class="text-xs uppercase tracking-wider text-slate-500">With a comment · 30d</p>
          <p class="text-3xl font-bold mt-1">{{ data.summary.withMessagePct30d }}%</p>
        </UCard>
        <UCard>
          <p class="text-xs uppercase tracking-wider text-slate-500">Distribution · 90d</p>
          <div class="flex gap-1 mt-2" aria-label="Star distribution">
            <div v-for="s in [1, 2, 3, 4, 5] as const" :key="s" class="flex-1 flex flex-col items-center gap-0.5">
              <div class="w-full h-12 flex items-end">
                <div
                  class="w-full rounded-sm bg-amber-500/70"
                  :style="{ height: `${barPct(data.distribution[s], distMax)}%` }"
                  :title="`${s}★: ${data.distribution[s]}`"
                />
              </div>
              <span class="text-[10px] text-slate-500">{{ s }}</span>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Weekly trend -->
      <UCard>
        <p class="text-xs uppercase tracking-wider text-slate-500 mb-3">Weekly average · 12 weeks</p>
        <div class="flex items-end gap-2 h-32">
          <div v-for="w in data.weekly" :key="w.weekStart" class="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <div
              v-if="w.avgRating !== null"
              class="w-full rounded-t bg-amber-500/70 hover:bg-amber-400 transition-colors"
              :style="{ height: `${(w.avgRating / 5) * 100}%` }"
              :title="`${w.weekStart}: ${w.avgRating.toFixed(2)}★ from ${w.count}`"
            />
            <div v-else class="w-full h-px bg-slate-700" :title="`${w.weekStart}: no feedback`" />
            <span class="text-[10px] text-slate-500">{{ w.weekStart.slice(5) }}</span>
          </div>
        </div>
      </UCard>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3">
        <USelect v-model="ratingFilter" :items="ratingItems" value-key="value" class="w-36" />
        <USelect v-model="topicFilter" :items="topicItems" value-key="value" class="w-40" />
        <UCheckbox v-model="withMessage" label="Comments only" />
        <span class="text-sm text-slate-500 ml-auto">{{ data.total }} entries</span>
      </div>

      <!-- List -->
      <div class="space-y-3">
        <UCard v-for="item in data.items" :key="item.id">
          <div class="flex flex-wrap items-center gap-2 text-sm mb-1">
            <span v-if="item.rating" class="text-amber-400">{{ "★".repeat(item.rating) }}<span class="text-slate-600">{{ "★".repeat(5 - item.rating) }}</span></span>
            <UBadge v-for="tp in item.topics" :key="tp" color="neutral" variant="soft" size="sm">
              {{ FEEDBACK_TOPIC_LABELS[tp as FeedbackTopic] ?? tp }}
            </UBadge>
            <span class="text-slate-500 ml-auto text-xs">
              {{ item.userName ?? "Guest" }}{{ item.isGuest ? " (guest)" : "" }}
              · {{ item.platform ?? "?" }}
              <template v-if="item.gamesCompletedHint !== null"> · {{ item.gamesCompletedHint }} games</template>
              · {{ timeAgo(item.createdAt) }}
            </span>
          </div>
          <p v-if="item.message" class="whitespace-pre-wrap text-slate-200">{{ item.message }}</p>
          <p v-else class="text-slate-500 italic text-sm">No comment</p>
        </UCard>
        <p v-if="data.items.length === 0" class="text-slate-500 text-sm">Nothing here yet.</p>
      </div>

      <UPagination
        v-if="data.total > PAGE_SIZE"
        v-model:page="page"
        :total="data.total"
        :items-per-page="PAGE_SIZE"
      />
    </template>
  </div>
</template>
