<script setup lang="ts">
import { computed } from "vue";
import type { UnifiedLobby } from "~~/server/utils/mergeLobbies";
import { phaseInfo } from "~/utils/lobbyPhase";
import {
  createdAtMs, displayName, formatAgo, formatDuration, hostName, leader, playedCount,
} from "~/utils/lobbyMonitorView";

const props = defineProps<{ lobby: UnifiedLobby; now: number }>();
const emit = defineEmits<{ open: [code: string] }>();

const MAX_AVATARS = 5;
const AVATAR_COLORS = ["bg-pink-400", "bg-lime-400", "bg-yellow-400", "bg-sky-400", "bg-orange-400", "bg-purple-400"];

const t = computed(() => props.lobby.teleportal!);
const phase = computed(() => phaseInfo(t.value.phase));
const waiting = computed(() => !t.value.phase || t.value.phase === "waiting");
const lead = computed(() => leader(props.lobby));
const played = computed(() => playedCount(props.lobby));

const subtitle = computed(() => {
  const parts = [props.lobby.code];
  const host = hostName(props.lobby);
  if (host) parts.push(`host ${host}`);
  const created = createdAtMs(props.lobby);
  if (created) parts.push(formatDuration(props.now - created));
  return parts.join(" · ");
});

const statusLine = computed(() => {
  const parts = [phase.value.label];
  if (!waiting.value && t.value.round) parts.push(`round ${t.value.round}`);
  if (!waiting.value && t.value.maxPoints) parts.push(`first to ${t.value.maxPoints}`);
  return parts.join(" · ");
});

const progress = computed(() => {
  if (waiting.value || !t.value.maxPoints) return null;
  return Math.min(100, Math.round(((lead.value?.score ?? 0) / t.value.maxPoints) * 100));
});

const footer = computed(() => {
  const n = t.value.players.length;
  const bots = t.value.players.filter((p) => p.isBot).length;
  const parts = [`${n} ${n === 1 ? "player" : "players"}`];
  if (played.value) parts.push(`${played.value.played}/${played.value.eligible} played`);
  else if (lead.value) parts.push(`leader ${lead.value.name} ${lead.value.score}pts`);
  else if (bots) parts.push(`${bots} ${bots === 1 ? "bot" : "bots"}`);
  return parts.join(" · ");
});

const initials = (name: string) => name.slice(0, 2).toUpperCase();
</script>

<template>
  <button
    type="button"
    data-testid="lobby-card"
    class="w-full rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-cyan-700 focus-visible:outline-2 focus-visible:outline-cyan-400"
    :class="{ 'opacity-70': waiting }"
    @click="emit('open', lobby.code)"
  >
    <div class="flex items-start justify-between gap-2">
      <p class="truncate text-base font-bold text-white">
        {{ displayName(lobby) }}
        <UIcon v-if="t.isPrivate || lobby.registry?.isPrivate" name="i-solar-lock-keyhole-bold" class="ml-1 text-slate-500" />
      </p>
      <AdminSourceBadge :source="lobby.source" />
    </div>
    <p class="mb-3 truncate text-sm text-slate-500">{{ subtitle }}</p>

    <div class="mb-1.5 flex items-baseline justify-between gap-2">
      <span data-testid="lobby-status" class="text-sm font-semibold" :class="phase.textClass">{{ statusLine }}</span>
      <span class="shrink-0 text-xs text-slate-500">active {{ formatAgo(t.idleSec) }}</span>
    </div>
    <div v-if="progress !== null" class="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
      <div data-testid="lobby-progress" class="h-full rounded-full bg-cyan-400" :style="{ width: `${progress}%` }" />
    </div>
    <div v-else class="mb-3 h-1.5" />

    <div class="flex items-center justify-between gap-2">
      <div class="flex -space-x-1.5">
        <span
          v-for="(p, i) in t.players.slice(0, MAX_AVATARS)"
          :key="p.id"
          :title="p.name"
          class="flex size-7 items-center justify-center overflow-hidden rounded-full border-2 border-slate-900 text-[10px] font-bold text-slate-950"
          :class="p.isBot ? 'bg-slate-500' : AVATAR_COLORS[i % AVATAR_COLORS.length]"
        >
          <img v-if="p.avatar" :src="p.avatar" :alt="p.name" class="size-full object-cover" />
          <template v-else>{{ p.isBot ? "🤖" : initials(p.name) }}</template>
        </span>
        <span
          v-if="t.players.length > MAX_AVATARS"
          class="flex size-7 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-700 text-[10px] font-bold text-slate-200"
        >
          +{{ t.players.length - MAX_AVATARS }}
        </span>
      </div>
      <span class="text-xs text-slate-500">{{ footer }}</span>
    </div>
  </button>
</template>
