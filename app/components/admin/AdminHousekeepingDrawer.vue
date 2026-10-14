<script setup lang="ts">
import type { UnifiedStatusResponse } from "~~/server/api/admin/teleportal/status.get";
import type { Housekeeping, HousekeepingItem } from "~~/server/utils/lobbyHousekeeping";
import { formatDuration } from "~/utils/lobbyMonitorView";

defineProps<{
  housekeeping: Housekeeping | null;
  server: UnifiedStatusResponse["server"] | null;
  liveGames: number;
  livePlayers: number;
}>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ pruneStale: []; pruneAll: []; endAll: []; endGame: [code: string] }>();

const list = (items: HousekeepingItem[]) =>
  items.map((i) => `${i.code} (${formatDuration(i.ageSec * 1000)})`).join(" · ");
</script>

<template>
  <USlideover v-model:open="open" title="Housekeeping" side="right">
    <template #body>
      <div v-if="housekeeping" class="space-y-4">
        <p class="text-sm text-slate-400">
          Leftovers nobody is playing in. The sweeper removes these by itself every 30 min — this is for when you don't want to wait.
        </p>

        <section data-testid="hk-db-only" class="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <p class="font-semibold text-white">
            Database-only lobbies · {{ housekeeping.dbOnlyStale.length + housekeeping.dbOnlyRecent.length }}
          </p>
          <p class="text-xs text-slate-400">A record exists but nobody has the game open — usually a host who closed the tab.</p>
          <p v-if="housekeeping.dbOnlyStale.length" class="mt-2 text-sm text-slate-300">Older than 2h: {{ list(housekeeping.dbOnlyStale) }}</p>
          <p v-if="housekeeping.dbOnlyRecent.length" class="mt-1 text-sm text-slate-500">Newer: {{ list(housekeeping.dbOnlyRecent) }}</p>
        </section>

        <section data-testid="hk-finished" class="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <p class="font-semibold text-white">Finished games · {{ housekeeping.finished.length }}</p>
          <p class="text-xs text-slate-400">Game over more than 1h ago, still in the database.</p>
          <p v-if="housekeeping.finished.length" class="mt-2 text-sm text-slate-300">{{ list(housekeeping.finished) }}</p>
        </section>

        <div class="grid gap-2 sm:grid-cols-2">
          <UButton data-testid="hk-prune-stale" size="lg" block color="warning" variant="soft" @click="emit('pruneStale')">
            Clean up stale leftovers
          </UButton>
          <UButton data-testid="hk-prune-all" size="lg" block color="neutral" variant="soft" @click="emit('pruneAll')">
            Remove all database-only lobbies…
          </UButton>
        </div>

        <section data-testid="hk-empty" class="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <p class="font-semibold text-white">Empty live rooms · {{ housekeeping.emptyRooms.length }}</p>
          <p class="text-xs text-slate-400">Live game with nobody connected. Expires by itself 10 min after the last person leaves.</p>
          <p v-for="room in housekeeping.emptyRooms" :key="room.code" class="mt-1 text-sm text-slate-300">
            {{ room.code }} · expires in about {{ Math.ceil(room.expiresInSec / 60) }} min
          </p>
        </section>

        <section data-testid="hk-no-record" class="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <p class="font-semibold text-white">Live games without a record · {{ housekeeping.noRecord.length }}</p>
          <p class="text-xs text-slate-400">The game is running but the database row is gone, so it can't show in the browser.</p>
          <div v-for="item in housekeeping.noRecord" :key="item.code" class="mt-2 flex items-center justify-between gap-2">
            <span class="text-sm text-slate-300">{{ item.code }}</span>
            <UButton :data-testid="`hk-end-${item.code}`" size="md" color="error" variant="soft" @click="emit('endGame', item.code)">
              End game…
            </UButton>
          </div>
        </section>

        <section class="rounded-lg border border-red-500/40 p-3">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-red-300">Danger zone</p>
          <UButton data-testid="hk-end-all" size="lg" block color="error" variant="soft" :disabled="liveGames === 0" @click="emit('endAll')">
            End every live game ({{ liveGames }}) &amp; disconnect {{ livePlayers }} players…
          </UButton>
          <p class="mt-1 text-xs text-slate-500">Emergencies only — e.g. a bad deploy left games in a broken state.</p>
        </section>
      </div>
    </template>
    <template #footer>
      <p v-if="server" class="text-xs text-slate-500">
        Sync worker {{ server.version }} · {{ server.activeDocuments }} live docs · {{ server.activeClients }} connections
      </p>
    </template>
  </USlideover>
</template>
