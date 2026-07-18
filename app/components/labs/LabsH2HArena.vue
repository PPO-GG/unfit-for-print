<!--
  Head-to-head voting arena — "Which is funnier?" pick between two
  random submissions.

  STUB: picks a random pair of playtest/new submissions each round and
  tracks the user's choices in local state. Nothing persists — the
  underlying h2h voting system (pairwise comparison tournaments, ELO
  ranking, etc.) isn't built yet. See future-features doc.
-->
<template>
  <div v-if="pair.length === 2" id="h2h" class="h2h-arena">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3 relative z-10">
      <div>
        <div
          class="font-mono uppercase mb-1"
          :style="{
            fontSize: '10px',
            letterSpacing: '0.2em',
            color: 'var(--ink-muted)',
          }"
        >
          Round {{ round }} · Pick the funnier card
        </div>
        <div
          class="font-display uppercase"
          :style="{ fontSize: '28px', color: 'var(--ink)' }"
        >
          Which is funnier?
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="labs-chip orange">
          <LabsIcon name="flame" :size="11" /> Streak {{ streak }}
        </div>
        <button class="labs-btn" :disabled="winner !== null" @click="next">
          Skip <LabsIcon name="arrow-right" :size="12" />
        </button>
      </div>
    </div>

    <div class="h2h-grid relative z-10">
      <div
        v-for="(card, idx) in pair"
        :key="card.id + '-' + idx"
        class="h2h-card-wrap flex flex-col items-center gap-3"
        :class="{ right: idx === 1 }"
        :style="cardStyle(idx)"
        @click="choose(idx)"
      >
        <LabsCahCard
          :kind="card.kind"
          :text="card.text"
          :pick="card.pick"
          size="md"
        />
        <div class="flex items-center gap-2">
          <div
            class="labs-avatar"
            :style="{
              background: card.authorBg,
              width: '26px',
              height: '26px',
              fontSize: '10px',
            }"
          >
            {{ card.initials }}
          </div>
          <div
            class="font-mono uppercase"
            :style="{
              fontSize: '10px',
              letterSpacing: '0.2em',
              color: 'var(--ink-dim)',
            }"
          >
            by {{ card.author }}
          </div>
        </div>
        <div v-if="winner === idx" class="labs-chip lime fade-in">
          ✓ YOUR PICK
        </div>
      </div>

      <!-- VS badge center -->
      <div class="vs-badge-wrap hidden md:flex">
        <div class="vs-badge">VS</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LabsSubmission } from "~/types/labs";

const props = defineProps<{ submissions: LabsSubmission[] }>();

const round = ref(1);
const streak = ref(0);
const winner = ref<number | null>(null);

const eligible = computed(() =>
  props.submissions.filter(
    (s) => s.status === "playtest" || s.status === "new",
  ),
);

function pickPair(): LabsSubmission[] {
  const pool = eligible.value;
  if (pool.length < 2) return [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return [shuffled[0]!, shuffled[1]!];
}

const pair = ref<LabsSubmission[]>([]);

watch(
  eligible,
  (list) => {
    if (pair.value.length !== 2 && list.length >= 2) {
      pair.value = pickPair();
    }
  },
  { immediate: true },
);

function next() {
  winner.value = null;
  pair.value = pickPair();
  round.value += 1;
}

function choose(idx: number) {
  if (winner.value !== null) return;
  winner.value = idx;
  streak.value += 1;
  window.setTimeout(next, 1100);
}

function cardStyle(idx: number) {
  if (winner.value === null) {
    return { opacity: 1, transition: "all 0.3s ease" };
  }
  if (winner.value === idx) {
    return {
      opacity: 1,
      transform: "translateY(-12px) scale(1.04)",
      transition: "all 0.3s ease",
    };
  }
  return {
    opacity: 0.3,
    transform: "scale(0.95)",
    transition: "all 0.3s ease",
  };
}

defineExpose({ scrollIntoView: () => {
  if (!import.meta.client) return;
  document.getElementById("h2h")?.scrollIntoView({ behavior: "smooth", block: "start" });
} });
</script>

<style scoped>
.h2h-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: center;
}
@media (min-width: 768px) {
  .h2h-grid {
    grid-template-columns: 1fr auto 1fr;
  }
}
.vs-badge-wrap {
  align-items: center;
  justify-content: center;
}
</style>
