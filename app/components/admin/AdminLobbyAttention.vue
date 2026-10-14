<script setup lang="ts">
import type { UnifiedLobby } from "~~/server/utils/mergeLobbies";
import type { LobbyHealth } from "~/utils/lobbyHealth";
import { displayName } from "~/utils/lobbyMonitorView";

defineProps<{ items: { lobby: UnifiedLobby; health: LobbyHealth }[] }>();
const emit = defineEmits<{ inspect: [code: string] }>();
</script>

<template>
  <section>
    <h2 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
      Needs attention · {{ items.length }}
    </h2>
    <p v-if="items.length === 0" class="text-sm text-lime-300">All games healthy.</p>
    <div v-else class="grid gap-3 md:grid-cols-2">
      <div
        v-for="{ lobby, health } in items"
        :key="lobby.code"
        data-testid="attention-row"
        class="flex items-center justify-between gap-3 rounded-xl border border-slate-800 border-l-4 bg-slate-900 p-3"
        :class="health.level === 'red' ? 'border-l-red-500' : 'border-l-amber-500'"
      >
        <div class="min-w-0">
          <p class="truncate font-semibold text-white">{{ lobby.code }} · {{ displayName(lobby) }}</p>
          <p class="text-sm" :class="health.level === 'red' ? 'text-red-300' : 'text-amber-300'">
            {{ health.reason }}
          </p>
        </div>
        <UButton size="md" color="neutral" variant="soft" @click="emit('inspect', lobby.code)">
          Inspect
        </UButton>
      </div>
    </div>
  </section>
</template>
