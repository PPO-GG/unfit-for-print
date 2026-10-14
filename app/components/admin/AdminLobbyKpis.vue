<script setup lang="ts">
import { computed } from "vue";
import type { ActivityStats } from "~~/server/utils/activity";
import type { LiveKpis } from "~/utils/lobbyMonitorView";

const props = defineProps<{ kpis: LiveKpis; activity: ActivityStats | null }>();

const sourceTotal = computed(() => {
  const s = props.kpis.bySource;
  return s.discord + s.web + s.unknown;
});
const pct = (n: number) => (sourceTotal.value ? (n / sourceTotal.value) * 100 : 0);

const discordShare = computed(() => {
  const p = props.activity?.playersBySource;
  if (!p) return null;
  const known = p.discord + p.web;
  return known ? Math.round((p.discord / known) * 100) : null;
});
</script>

<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div data-testid="kpi-games" class="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Games running</p>
      <p class="text-3xl font-bold text-white tabular-nums">{{ kpis.gamesRunning }}</p>
      <p class="text-xs text-slate-500">+{{ kpis.waiting }} waiting in lobby</p>
    </div>
    <div data-testid="kpi-players" class="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Players now</p>
      <p class="text-3xl font-bold text-white tabular-nums">{{ kpis.players }}</p>
      <p class="text-xs text-slate-500">{{ kpis.humans }} {{ kpis.humans === 1 ? "human" : "humans" }} · {{ kpis.bots }} {{ kpis.bots === 1 ? "bot" : "bots" }}</p>
    </div>
    <div data-testid="kpi-source" class="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Where from (now)</p>
      <div class="my-3 flex h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div class="bg-[#5865f2]" :style="{ width: `${pct(kpis.bySource.discord)}%` }" />
        <div class="bg-cyan-500" :style="{ width: `${pct(kpis.bySource.web)}%` }" />
        <div class="bg-slate-600" :style="{ width: `${pct(kpis.bySource.unknown)}%` }" />
      </div>
      <p class="text-xs text-slate-500">
        <span class="text-[#a5b0ff]">Discord {{ kpis.bySource.discord }}</span>
        · <span class="text-cyan-300">Web {{ kpis.bySource.web }}</span>
        <template v-if="kpis.bySource.unknown"> · Unknown {{ kpis.bySource.unknown }}</template>
      </p>
    </div>
    <div data-testid="kpi-24h" class="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Last {{ activity?.windowHours ?? 24 }}h
      </p>
      <template v-if="activity">
        <p class="text-3xl font-bold text-white tabular-nums">
          {{ activity.lobbiesCreated }}
          <span class="text-sm font-medium text-slate-500">{{ activity.lobbiesCreated === 1 ? "lobby" : "lobbies" }}</span>
        </p>
        <p class="text-xs text-slate-500">
          {{ activity.uniquePlayers }} {{ activity.uniquePlayers === 1 ? "player" : "players" }}<template v-if="discordShare !== null"> · Discord {{ discordShare }}%</template>
        </p>
        <p v-if="activity.playersBySource.unknown" class="text-xs text-slate-600">
          {{ activity.playersBySource.unknown }} {{ activity.playersBySource.unknown === 1 ? "player" : "players" }} from before tracking
        </p>
      </template>
      <p v-else class="text-3xl font-bold text-slate-600">—</p>
    </div>
  </div>
</template>
