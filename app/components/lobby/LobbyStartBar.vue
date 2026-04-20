<template>
  <footer class="lobby-startbar lobby-panel">
    <!-- Left: stats -->
    <div class="lsb-stats">
      <span class="lsb-stat">
        <span class="lsb-stat-val">{{ players.length }}</span>
        <span class="lsb-stat-lbl">Players</span>
      </span>
      <span class="lsb-divider" />
      <span class="lsb-stat">
        <span class="lsb-stat-val">{{ readyCount }}</span>
        <span class="lsb-stat-lbl">Ready</span>
      </span>
      <span class="lsb-progress">
        <span class="lsb-progress-bar" :style="{ width: progressPct + '%' }" />
      </span>
    </div>

    <!-- Right: actions -->
    <div class="lsb-actions">
      <!-- Ready toggle (all players) -->
      <button
        class="neon-btn"
        :class="myReady ? 'neon-btn--ready-active' : 'neon-btn--ghost'"
        @click="$emit('toggle-ready')"
      >
        <span
          class="lsb-ready-dot"
          :class="{ 'lsb-ready-dot--on': myReady }"
        />
        {{ myReady ? "I'm Ready ✓" : "I'm Ready" }}
      </button>

      <!-- Start button (host only) -->
      <template v-if="isHost">
        <button
          v-if="!isStarting"
          class="neon-btn neon-btn--primary"
          :disabled="!canStart"
          @click="$emit('start')"
        >
          ▶ START GAME
        </button>
        <button v-else class="neon-btn neon-btn--primary" disabled>
          Starting…
        </button>
      </template>

      <!-- Non-host status -->
      <div v-else class="lsb-waiting-label">
        {{ allNonBotsReady ? "Waiting for host…" : "Waiting for players to ready up…" }}
      </div>
    </div>
  </footer>
</template>

<script lang="ts" setup>
import type { Player } from "~/types/player";

const props = defineProps<{
  players: Player[];
  myId: string;
  isHost: boolean;
  isStarting: boolean;
}>();

defineEmits<{
  (e: "toggle-ready"): void;
  (e: "start"): void;
}>();

const nonBotPlayers = computed(() =>
  props.players.filter((p) => p.playerType !== "bot"),
);

const readyCount = computed(
  () => props.players.filter((p) => p.playerType === "bot" || p.ready).length,
);

const allNonBotsReady = computed(() =>
  nonBotPlayers.value.length > 0 &&
  nonBotPlayers.value.every((p) => p.ready),
);

const canStart = computed(
  () => props.players.length >= 3 && allNonBotsReady.value,
);

const myReady = computed(() => {
  const me = props.players.find((p) => p.userId === props.myId);
  return me?.ready ?? false;
});

const progressPct = computed(() =>
  props.players.length === 0
    ? 0
    : Math.round((readyCount.value / props.players.length) * 100),
);
</script>

<style scoped>
.lobby-startbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-bottom: none;
  flex-shrink: 0;
  z-index: 10;
  position: relative;
  flex-wrap: wrap;
}

.lsb-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lsb-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.lsb-stat-val {
  font-family: 'Archivo Black', sans-serif;
  font-size: 20px;
  color: var(--lb-ink);
  line-height: 1;
}

.lsb-stat-lbl {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--lb-ink-muted);
}

.lsb-divider {
  width: 1px;
  height: 28px;
  background: var(--lb-line);
}

.lsb-progress {
  width: 80px;
  height: 3px;
  background: var(--lb-line);
  border-radius: 999px;
  overflow: hidden;
}

.lsb-progress-bar {
  height: 100%;
  background: var(--lb-accent-lime);
  border-radius: 999px;
  transition: width 0.4s ease;
}

.lsb-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lsb-ready-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--lb-ink-muted);
  flex-shrink: 0;
}

.lsb-ready-dot--on {
  background: #0d0f1a;
}

.lsb-waiting-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--lb-ink-muted);
}
</style>
