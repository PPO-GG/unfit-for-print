<!--
  Labs hero: eyebrow chips + big title + blurb + CTAs, with a 4-up
  stats panel on the right. `totalSubmissions` / `votesCast` are real
  (derived from the live stream). `inPlaytest` / `graduated` /
  `thisWeek` are stubs — see future-features doc.
-->
<template>
  <div class="lab-hero">
    <LabsBeaker />
    <div class="relative z-10 grid grid-cols-12 gap-6 items-center">
      <div class="col-span-12 lg:col-span-7">
        <div class="flex items-center gap-2 mb-3 flex-wrap">
          <div class="labs-chip lime">
            <LabsIcon name="beaker" :size="10" /> COMMUNITY R&D
          </div>
          <div class="labs-chip">
            <span :style="{ color: 'var(--accent-lime)' }">●</span>
            {{ stats.thisWeek }} this week
          </div>
        </div>
        <h1
          class="font-display leading-[0.9] mb-3"
          style="font-size: clamp(48px, 6.5vw, 80px); color: var(--ink)"
        >
          UNFIT <span :style="{ color: 'var(--accent-lime)' }">LABS</span>
        </h1>
        <div
          class="font-cond mb-5 max-w-2xl leading-snug"
          style="font-size: 1.25rem; color: var(--ink-dim); text-wrap: pretty"
        >
          Where bad taste gets peer-reviewed. Submit cards, vote on
          what's funny, and watch the worst ones graduate to the main
          deck.
        </div>
        <div class="flex flex-wrap gap-3">
          <button class="labs-btn lime large" @click="emit('submit')">
            <LabsIcon name="plus" :size="14" /> Submit a card
          </button>
          <button class="labs-btn large" @click="emit('startVoting')">
            <LabsIcon name="vs" :size="14" /> Start voting
          </button>
        </div>
      </div>
      <div class="col-span-12 lg:col-span-5 grid grid-cols-2 gap-3">
        <div class="labs-stat">
          <div class="k">Total submissions</div>
          <div class="v" :style="{ color: 'var(--accent-cyan)' }">
            {{ stats.totalSubmissions.toLocaleString() }}
          </div>
        </div>
        <div class="labs-stat">
          <div class="k">Votes cast</div>
          <div class="v" :style="{ color: 'var(--accent-yellow)' }">
            {{ formatThousands(stats.votesCast) }}
          </div>
        </div>
        <div class="labs-stat">
          <div class="k">In playtest</div>
          <div class="v" :style="{ color: 'var(--accent-orange)' }">
            {{ stats.inPlaytest }}
          </div>
        </div>
        <div class="labs-stat">
          <div class="k">Graduated</div>
          <div class="v" :style="{ color: 'var(--accent-lime)' }">
            {{ stats.graduated }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LabsStats } from "~/types/labs";

defineProps<{ stats: LabsStats }>();

const emit = defineEmits<{
  submit: [];
  startVoting: [];
}>();

function formatThousands(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
</script>
