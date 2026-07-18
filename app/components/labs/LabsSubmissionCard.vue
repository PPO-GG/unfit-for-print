<!--
  Single submission tile for the Labs feed. Left = CAH card preview,
  right = status pills, author, vote count with up/down buttons.

  Wired:
    - Up vote toggle → real (calls upvote handler from parent)
    - Admin delete / adopt → real when `admin` prop is true

  Stubbed:
    - Downvotes: schema has no downvote column. The down button is
      rendered but non-interactive (visual only).
-->
<template>
  <div class="submission" :class="{ hot: sub.trend === 'hot' }">
    <!-- Card preview -->
    <div class="flex-shrink-0">
      <LabsCahCard
        :kind="sub.kind"
        :text="sub.text"
        :pick="sub.pick"
        size="sm"
      />
    </div>

    <!-- Right column -->
    <div class="submission-meta">
      <div class="flex items-center gap-1.5 flex-wrap">
        <div class="status-pill" :class="sub.status">{{ sub.status }}</div>
        <div
          class="labs-chip"
          :class="sub.kind === 'prompt' ? 'purple' : 'cyan'"
          :style="{ fontSize: '9px', padding: '3px 7px' }"
        >
          {{ sub.kind === "prompt" ? "PROMPT" : "ANSWER" }}
        </div>
        <div
          v-if="sub.trend === 'hot'"
          class="labs-chip orange"
          :style="{ fontSize: '9px', padding: '3px 7px' }"
        >
          <LabsIcon name="flame" :size="10" /> HOT
        </div>
      </div>

      <div class="flex items-center gap-2 mt-1">
        <div
          class="labs-avatar"
          :style="{
            background: sub.authorBg,
            width: '24px',
            height: '24px',
            fontSize: '9px',
          }"
        >
          {{ sub.initials }}
        </div>
        <div class="flex-1 min-w-0">
          <div
            class="font-display uppercase leading-none truncate"
            style="font-size: 12px"
          >
            {{ sub.author }}
          </div>
          <div
            class="font-mono uppercase mt-0.5"
            :style="{
              fontSize: '9px',
              letterSpacing: '0.2em',
              color: 'var(--ink-muted)',
            }"
          >
            {{ sub.date }}
          </div>
        </div>
      </div>

      <div
        v-if="sub.up + sub.down > 0"
        class="font-mono uppercase"
        :style="{
          fontSize: '9px',
          letterSpacing: '0.2em',
          color: 'var(--ink-muted)',
        }"
      >
        {{ positivePct }}% positive
      </div>

      <!-- Admin actions -->
      <div v-if="admin" class="flex items-center gap-2">
        <button
          class="labs-btn"
          style="padding: 6px 10px; font-size: 10px"
          @click="emit('adopt', sub)"
        >
          <LabsIcon name="check" :size="12" /> Adopt
        </button>
        <button
          class="labs-btn"
          style="padding: 6px 10px; font-size: 10px"
          @click="emit('delete', sub.id)"
        >
          <LabsIcon name="trash" :size="12" /> Delete
        </button>
      </div>

      <!-- Vote bar -->
      <div class="submission-votes">
        <button
          type="button"
          class="vote-btn up"
          :class="{ active: hasUpvoted }"
          :disabled="!loggedIn || upvoting"
          :title="loggedIn ? 'Upvote' : 'Log in to vote'"
          @click="emit('upvote', sub.id)"
        >
          <LabsIcon name="arrow-up" :size="14" />
        </button>
        <div class="vote-score">{{ scoreLabel }}</div>
        <button
          type="button"
          class="vote-btn down"
          :disabled="true"
          title="Downvotes coming soon"
        >
          <LabsIcon name="arrow-down" :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LabsSubmission } from "~/types/labs";

const props = defineProps<{
  sub: LabsSubmission;
  loggedIn: boolean;
  currentUserId?: string | null;
  admin?: boolean;
  upvoting?: boolean;
}>();

const emit = defineEmits<{
  upvote: [id: string];
  delete: [id: string];
  adopt: [sub: LabsSubmission];
}>();

const hasUpvoted = computed(() => {
  if (!props.currentUserId) return false;
  return props.sub.upvoterIds.includes(props.currentUserId);
});

const positivePct = computed(() => {
  const total = props.sub.up + props.sub.down;
  if (total === 0) return 100;
  return Math.round((props.sub.up / total) * 100);
});

const scoreLabel = computed(() => {
  const score = props.sub.up - props.sub.down;
  if (score >= 1000) return `${(score / 1000).toFixed(1)}k`;
  return String(score);
});
</script>
