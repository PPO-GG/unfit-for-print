<!--
  Top contributors + hall-of-fame panels.

  STUB: both panels render entirely from mock data. The contributor
  leaderboard needs per-submitter rollups (submissions / graduated /
  totalUp) and the hall of fame needs historical top-voted cards. See
  future-features doc for the wiring plan.
-->
<template>
  <div class="grid grid-cols-12 gap-4">
    <!-- Top contributors -->
    <div class="col-span-12 lg:col-span-7 labs-panel p-5 flex flex-col gap-3">
      <div class="flex items-center justify-between mb-1">
        <div>
          <div
            class="font-display uppercase"
            :style="{ fontSize: '20px', color: 'var(--ink)' }"
          >
            Top Lab Rats
          </div>
          <div
            class="font-mono uppercase mt-1"
            :style="{
              fontSize: '10px',
              letterSpacing: '0.2em',
              color: 'var(--ink-muted)',
            }"
          >
            All-time contributors · ranked by upvotes
          </div>
        </div>
        <div class="seg">
          <button
            v-for="w in WINDOWS"
            :key="w.id"
            type="button"
            :class="{ active: leaderboardWindow === w.id }"
            @click="leaderboardWindow = w.id"
          >
            {{ w.label }}
          </button>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <div
          v-for="c in contributors"
          :key="c.rank"
          class="lb-row"
          :class="[
            { gold: c.rank === 1, silver: c.rank === 2, bronze: c.rank === 3 },
            { self: c.self },
          ]"
        >
          <div class="lb-rank">#{{ c.rank }}</div>
          <div
            class="labs-avatar"
            :style="{
              background: c.bg,
              width: '40px',
              height: '40px',
              fontSize: '14px',
            }"
          >
            {{ c.initials }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <div
                class="font-display uppercase leading-none"
                :style="{ fontSize: '16px', color: 'var(--ink)' }"
              >
                {{ c.name }}
              </div>
              <div
                v-if="c.self"
                class="labs-chip lime"
                :style="{ fontSize: '8px', padding: '2px 6px' }"
              >YOU</div>
              <div
                class="labs-chip"
                :style="{
                  fontSize: '9px',
                  padding: '2px 6px',
                  color: c.rank <= 3 ? 'var(--accent-yellow)' : 'var(--ink-dim)',
                }"
              >
                {{ c.badge }}
              </div>
            </div>
            <div
              class="font-mono uppercase mt-1"
              :style="{
                fontSize: '10px',
                letterSpacing: '0.2em',
                color: 'var(--ink-muted)',
              }"
            >
              {{ c.submissions }} submissions · {{ c.graduated }} graduated
            </div>
          </div>
          <div class="text-right">
            <div
              class="font-display tabular-nums"
              :style="{ fontSize: '20px', color: 'var(--accent-cyan)' }"
            >
              {{ c.totalUp.toLocaleString() }}
            </div>
            <div
              class="font-mono uppercase"
              :style="{
                fontSize: '9px',
                letterSpacing: '0.2em',
                color: 'var(--ink-muted)',
              }"
            >
              total upvotes
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Hall of fame -->
    <div class="col-span-12 lg:col-span-5 labs-panel p-5 flex flex-col gap-3">
      <div>
        <div
          class="font-display uppercase"
          :style="{ fontSize: '20px', color: 'var(--ink)' }"
        >
          Hall of Fame
        </div>
        <div
          class="font-mono uppercase mt-1"
          :style="{
            fontSize: '10px',
            letterSpacing: '0.2em',
            color: 'var(--ink-muted)',
          }"
        >
          Highest-voted cards of all time
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <div
          v-for="(c, i) in topCards"
          :key="c.id"
          class="flex items-center gap-3 p-2 rounded-lg"
          :style="{
            border: '1px solid var(--line)',
            background:
              i === 0
                ? 'linear-gradient(90deg, rgba(255,220,80,0.08), transparent)'
                : 'rgba(255,255,255,0.02)',
          }"
        >
          <div
            class="font-display w-7 text-center"
            :style="{
              fontSize: '22px',
              color: i === 0 ? 'var(--accent-yellow)' : 'var(--ink-muted)',
              textShadow: i === 0 ? '0 0 10px var(--accent-yellow)' : 'none',
            }"
          >
            {{ i + 1 }}
          </div>
          <LabsCahCard :kind="c.kind" :text="c.text" size="sm" />
          <div class="flex-1 min-w-0">
            <div
              class="font-display uppercase truncate"
              :style="{ fontSize: '13px', color: 'var(--ink)' }"
            >
              {{ c.author }}
            </div>
            <div
              class="font-mono uppercase"
              :style="{
                fontSize: '10px',
                letterSpacing: '0.2em',
                color: 'var(--ink-muted)',
              }"
            >
              {{ c.status }} · {{ c.date }}
            </div>
            <div
              class="font-display mt-1"
              :style="{ fontSize: '18px', color: 'var(--accent-lime)' }"
            >
              {{ formatK(c.up) }}
              <span :style="{ fontSize: '12px', color: 'var(--ink-dim)' }">
                upvotes
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LabsContributor, LabsSubmission, LeaderboardWindow } from "~/types/labs";

const props = defineProps<{
  contributors: LabsContributor[];
  submissions: LabsSubmission[];
}>();

const leaderboardWindow = ref<LeaderboardWindow>("all");

const WINDOWS: { id: LeaderboardWindow; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All-time" },
];

const topCards = computed(() =>
  [...props.submissions].sort((a, b) => b.up - a.up).slice(0, 5),
);

function formatK(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
</script>
