<script setup lang="ts">
import { computed } from "vue";
import type { LobbyIssue } from "~~/server/utils/lobbyIssues";
import type { UnifiedLobby } from "~~/server/utils/mergeLobbies";
import type { LobbyHealth } from "~/utils/lobbyHealth";
import { phaseInfo } from "~/utils/lobbyPhase";
import {
  createdAtMs, displayName, formatAgo, formatDuration, hostName, isOnline, leader,
} from "~/utils/lobbyMonitorView";

const props = defineProps<{
  code: string | null;
  lobby: UnifiedLobby | null;
  issues: LobbyIssue[];
  health: LobbyHealth | null;
  now: number;
}>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{
  markFinished: [lobby: UnifiedLobby];
  endGame: [lobby: UnifiedLobby];
  removeCompletely: [lobby: UnifiedLobby];
  deleteRecord: [lobby: UnifiedLobby];
  copyCode: [code: string];
}>();

const t = computed(() => props.lobby?.teleportal ?? null);
const phase = computed(() => phaseInfo(t.value?.phase));
const lead = computed(() => (props.lobby ? leader(props.lobby) : null));
const submitting = computed(() => t.value?.phase === "submitting" || t.value?.phase === "submitting-complete");

const subtitle = computed(() => {
  const l = props.lobby;
  if (!l) return "";
  const parts = [l.code];
  const host = hostName(l);
  if (host) parts.push(`host ${host}`);
  const created = createdAtMs(l);
  if (created) parts.push(`started ${formatDuration(props.now - created)} ago`);
  if (t.value?.maxPoints) parts.push(`first to ${t.value.maxPoints} points`);
  return parts.join(" · ");
});

const players = computed(() => {
  const l = props.lobby;
  const tp = t.value;
  if (!l || !tp) return [];
  const played = new Set(tp.submittedIds);
  return tp.players.map((p) => ({
    ...p,
    isHost: p.id === tp.hostUserId,
    isJudge: p.id === tp.judgeId,
    online: p.isBot ? null : isOnline(l, p.id),
    played: submitting.value && played.has(p.id),
    score: tp.scores[p.id] ?? 0,
  }));
});

const scorePct = (score: number) =>
  t.value?.maxPoints ? Math.min(100, Math.round((score / t.value.maxPoints) * 100)) : 0;

const can = computed(() => {
  const l = props.lobby;
  return {
    markFinished: !!l?.registry && l.registry.status !== "complete",
    endGame: !!l?.hasLiveDoc,
    removeCompletely: !!l?.hasLiveDoc && !!l?.hasRegistry,
    deleteRecord: !!l?.hasRegistry && !l?.hasLiveDoc,
  };
});
</script>

<template>
  <USlideover v-model:open="open" :title="lobby ? displayName(lobby) : (code ?? 'Lobby')" side="right">
    <template #body>
      <div v-if="!lobby" class="py-10 text-center text-slate-400">
        {{ code }} is no longer live.
      </div>
      <div v-else class="space-y-5">
        <div>
          <div class="flex items-center gap-2"><AdminSourceBadge :source="lobby.source" /></div>
          <p class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>
        </div>

        <div
          v-if="health"
          data-testid="drawer-alert"
          class="rounded-lg border p-3"
          :class="health.level === 'red' ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-amber-500/40 bg-amber-500/10 text-amber-200'"
        >
          <p class="font-semibold">{{ health.reason }}</p>
        </div>
        <ul v-if="issues.length" class="space-y-1 text-sm">
          <li v-for="issue in issues" :key="issue.groupId">
            <NuxtLink :to="`/admin/issues/${issue.groupId}`" class="text-cyan-300 hover:underline">
              {{ issue.title }}
            </NuxtLink>
            <span class="text-slate-500"> · {{ issue.kind }} · {{ issue.eventCount }} in the last 30 min</span>
          </li>
        </ul>

        <div v-if="t" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <p class="text-xs uppercase tracking-wider text-slate-400">Phase</p>
            <p class="font-semibold" :class="phase.textClass">{{ phase.label }}</p>
          </div>
          <div class="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <p class="text-xs uppercase tracking-wider text-slate-400">Round</p>
            <p class="font-semibold text-white">{{ t.round ?? "—" }}</p>
            <p v-if="lead && t.maxPoints" class="text-xs text-slate-500">leader at {{ lead.score }}/{{ t.maxPoints }}</p>
          </div>
          <div class="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <p class="text-xs uppercase tracking-wider text-slate-400">Connected</p>
            <p class="font-semibold text-white">{{ t.clients }} of {{ t.players.filter((p) => !p.isBot).length }}</p>
            <p class="text-xs text-slate-500">tabs open</p>
          </div>
          <div class="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <p class="text-xs uppercase tracking-wider text-slate-400">Last move</p>
            <p class="font-semibold text-white">{{ formatAgo(t.idleSec) }}</p>
          </div>
        </div>

        <section v-if="players.length">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Players</h3>
          <div class="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-900 px-3">
            <div v-for="p in players" :key="p.id" data-testid="drawer-player" class="flex items-center gap-3 py-2">
              <div class="min-w-0 flex-1">
                <p class="flex flex-wrap items-center gap-1.5 font-semibold text-white">
                  {{ p.name }}
                  <span v-if="p.isHost" class="rounded-full bg-slate-700 px-2 text-xs text-slate-200">host</span>
                  <span v-if="p.isJudge" class="rounded-full bg-fuchsia-500/20 px-2 text-xs text-fuchsia-300">judge</span>
                  <span v-if="p.isBot" class="rounded-full bg-slate-700 px-2 text-xs text-slate-200">bot</span>
                  <span v-if="p.playerType === 'spectator'" class="rounded-full bg-slate-700 px-2 text-xs text-slate-200">spectator</span>
                </p>
                <p class="text-xs">
                  <span v-if="p.online === true" class="text-lime-300">● online</span>
                  <span v-else-if="p.online === false" class="text-slate-500">● offline</span>
                  <span v-if="p.played" class="text-lime-300"><template v-if="p.online !== null"> · </template>played ✓</span>
                </p>
              </div>
              <div v-if="t?.maxPoints" class="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                <div class="h-full bg-cyan-400" :style="{ width: `${scorePct(p.score)}%` }" />
              </div>
              <span class="w-6 text-right font-bold tabular-nums text-white">{{ p.score }}</span>
            </div>
          </div>
        </section>

        <section>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Fix it</h3>
          <div class="grid gap-3 sm:grid-cols-2">
            <div v-if="can.markFinished">
              <UButton data-testid="action-mark-finished" size="lg" block color="warning" variant="soft" @click="emit('markFinished', lobby)">
                Mark finished
              </UButton>
              <p class="mt-1 text-xs text-slate-500">Hides it from the public browser. Players stay connected.</p>
            </div>
            <div v-if="can.endGame">
              <UButton data-testid="action-end-game" size="lg" block color="error" variant="soft" @click="emit('endGame', lobby)">
                End game &amp; disconnect all…
              </UButton>
              <p class="mt-1 text-xs text-slate-500">Wipes the live game and kicks everyone. The lobby record stays.</p>
            </div>
            <div>
              <UButton data-testid="action-copy" size="lg" block color="neutral" variant="soft" @click="emit('copyCode', lobby.code)">
                Copy lobby code
              </UButton>
            </div>
            <div v-if="can.removeCompletely">
              <UButton data-testid="action-remove" size="lg" block color="error" variant="soft" @click="emit('removeCompletely', lobby)">
                Remove completely…
              </UButton>
              <p class="mt-1 text-xs text-slate-500">Ends the game and deletes the lobby record and players.</p>
            </div>
            <div v-if="can.deleteRecord">
              <UButton data-testid="action-delete-record" size="lg" block color="error" variant="soft" @click="emit('deleteRecord', lobby)">
                Delete lobby record…
              </UButton>
              <p class="mt-1 text-xs text-slate-500">Nobody has this game open. Removes the record and players.</p>
            </div>
          </div>
        </section>
      </div>
    </template>
  </USlideover>
</template>
