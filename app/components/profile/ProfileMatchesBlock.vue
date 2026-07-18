<!--
  Match history list. Each row shows trophy + placement + prompt snippet
  + opponent avatar stack + score. The "View all games" button is a
  placeholder — we don't persist match records yet. See
  docs/ui-overhaul-future-features.md § Profile.
-->
<template>
  <div class="flex flex-col gap-3">
    <div class="sect-h" style="margin-bottom: 0">
      <div class="title">
        Match history ·
        <span style="color: var(--ink-dim)">
          Last {{ matches.length }} games
        </span>
      </div>
      <div
        class="count-badge flex items-center gap-3"
      >
        <span :style="{ color: 'var(--accent-yellow)' }">● Wins</span>
        <span :style="{ color: 'var(--ink-muted)' }">● Losses</span>
      </div>
    </div>

    <div
      v-for="m in matches"
      :key="m.id"
      class="match-row"
      :class="m.placement === 1 ? 'win' : 'loss'"
    >
      <div class="flex items-center gap-3 min-w-0">
        <div style="font-size: 22px; line-height: 1">
          {{ trophyFor(m.placement) }}
        </div>
        <div class="flex flex-col min-w-0">
          <div class="font-display uppercase" style="font-size: 14px">
            {{ m.placement === 1 ? "WIN" : `#${m.placement}` }}
          </div>
          <div
            class="font-mono uppercase"
            :style="{
              fontSize: '10px',
              letterSpacing: '0.2em',
              color: 'var(--ink-muted)',
            }"
          >
            {{ m.date }} · {{ m.duration }} · {{ m.rounds }} rounds
          </div>
        </div>
      </div>

      <div
        class="min-w-0 font-cond italic truncate"
        :style="{ fontSize: '15px', color: 'var(--ink-dim)' }"
      >
        "{{ m.prompt }}"
      </div>

      <div class="flex items-center">
        <div
          v-for="(o, i) in m.opponents"
          :key="i"
          class="flex-shrink-0 font-display"
          :style="{
            width: '28px',
            height: '28px',
            fontSize: '10px',
            borderRadius: '50%',
            background: opponentBg(i),
            color: '#0a0d1c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: i === 0 ? '0' : '-6px',
            border: '2px solid var(--bg-0, #05060d)',
          }"
        >
          {{ o }}
        </div>
      </div>

      <div
        class="font-mono tabular-nums"
        :style="{ fontSize: '14px', color: 'var(--ink-dim)' }"
      >
        {{ m.score }}
      </div>
    </div>

    <button class="profile-btn w-max self-center mt-2" disabled>
      View all games →
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ProfileMatch } from "~/types/profile";

defineProps<{ matches: ProfileMatch[] }>();

function trophyFor(placement: number) {
  if (placement === 1) return "🥇";
  if (placement === 2) return "🥈";
  if (placement === 3) return "🥉";
  return `#${placement}`;
}

const OPPONENT_BGS = [
  "oklch(72% 0.22 355)",
  "oklch(80% 0.20 140)",
  "oklch(70% 0.22 260)",
  "oklch(82% 0.18 95)",
  "oklch(72% 0.18 20)",
];
function opponentBg(i: number) {
  return OPPONENT_BGS[i % OPPONENT_BGS.length];
}
</script>
