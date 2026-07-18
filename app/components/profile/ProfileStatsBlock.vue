<!--
  Top stats block: 4 accent tiles + sparkline card on the left, big
  win-rate donut on the right. Mirrors `StatsBlock` from the design
  prototype.
-->
<template>
  <div class="grid grid-cols-12 gap-4">
    <!-- Main stat tiles + sparkline -->
    <div class="col-span-12 lg:col-span-8 flex flex-col gap-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="stat-tile accent-yellow">
          <div class="k">Games won</div>
          <div class="v">{{ stats.wins }}</div>
          <div class="sub">of {{ stats.gamesPlayed }} played</div>
        </div>
        <div class="stat-tile accent-cyan">
          <div class="k">Rounds won</div>
          <div class="v">{{ stats.roundsWon }}</div>
          <div class="sub">{{ stats.cardsPlayed }} cards played</div>
        </div>
        <div class="stat-tile accent-pink">
          <div class="k">Streak</div>
          <div
            class="v"
            style="display: flex; align-items: baseline; gap: 6px"
          >
            {{ stats.currentStreak }}
            <span style="font-size: 14px; color: var(--ink-dim)">
              / {{ stats.bestStreak }} best
            </span>
          </div>
          <div class="sub">consecutive wins</div>
        </div>
        <div class="stat-tile accent-lime">
          <div class="k">Funniest</div>
          <div class="v">{{ stats.funniestCards }}</div>
          <div class="sub">rounds crowned</div>
        </div>
      </div>

      <div class="profile-panel p-5">
        <div class="sect-h" style="margin-bottom: 10px">
          <div class="title">Recent performance · last 20 games</div>
          <div class="count-badge" style="color: var(--accent-cyan)">
            Avg {{ stats.avgPointsPerGame }} pts/game
          </div>
        </div>
        <ProfileSparkline :data="stats.recentPoints" :height="80" />
      </div>
    </div>

    <!-- Win-rate donut -->
    <div
      class="col-span-12 lg:col-span-4 profile-panel p-5 flex flex-col gap-3 items-center justify-center"
    >
      <ProfileWinRateDonut :pct="stats.winRate" />
      <div class="text-center">
        <div
          class="font-mono uppercase mb-1"
          style="
            font-size: 10px;
            letter-spacing: 0.2em;
            color: var(--ink-muted);
          "
        >
          {{ stats.gamesPlayed }} games · {{ stats.playtimeHours }}h played
        </div>
        <div
          class="font-cond"
          style="font-size: 14px; color: var(--ink-dim)"
        >
          Favorite deck:
          <span style="color: var(--accent-lime); font-weight: 600">{{
            stats.favoriteDeck
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProfileStats } from "~/types/profile";

defineProps<{ stats: ProfileStats }>();
</script>
