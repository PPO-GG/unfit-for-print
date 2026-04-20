<template>
  <footer class="lobby-startbar lobby-panel" :style="panelStyle">
    <div class="lsb-state">
      <div class="lsb-ring">
        <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r="20" fill="none" stroke="var(--lb-line-strong)" stroke-width="3" />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            :stroke="ringColor"
            stroke-width="3"
            :stroke-dasharray="`${ringDash} 126`"
            stroke-linecap="round"
            transform="rotate(-90 24 24)"
          />
        </svg>
        <div class="lsb-ring-count">
          {{ players.length }}<span>/{{ maxSeats }}</span>
        </div>
      </div>
      <div class="lsb-labels">
        <div class="lsb-label-main">{{ stateLabel }}</div>
        <div class="lsb-label-sub">{{ stateSubLabel }}</div>
      </div>
    </div>

    <div class="lsb-spacer" />

    <div class="lsb-actions">
      <button
        v-if="isHost"
        class="neon-btn neon-btn--ghost lsb-btn"
        @click="$emit('add-bot')"
      >
        <span aria-hidden="true">🤖</span> ADD BOT
      </button>

      <button
        class="neon-btn lsb-btn"
        :class="{ 'neon-btn--ready-active': myReady }"
        @click="$emit('toggle-ready')"
      >
        <span aria-hidden="true">✓</span>
        {{ myReady ? "READY" : "READY UP" }}
      </button>

      <button
        v-if="isHost"
        class="neon-btn lsb-btn lsb-btn--start"
        :class="{ 'neon-btn--primary': canStart }"
        :disabled="!canStart || isStarting"
        @click="handleStart"
      >
        <span aria-hidden="true">▶</span>
        <template v-if="isStarting">STARTING…</template>
        <template v-else-if="canStart && countdown !== null && countdown > 0">START · {{ countdown }}</template>
        <template v-else>START NOW</template>
      </button>

      <div v-else class="lsb-waiting-label">
        {{ allNonBotsReady ? "Waiting for host…" : "Waiting for players…" }}
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
  maxSeats: number;
}>();

const emit = defineEmits<{
  (e: "toggle-ready"): void;
  (e: "start"): void;
  (e: "add-bot"): void;
}>();

const COUNTDOWN_SECONDS = 5;

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

const enoughPlayers = computed(() => props.players.length >= 3);

const myReady = computed(() => {
  const me = props.players.find((p) => p.userId === props.myId);
  return me?.ready ?? false;
});

// ── Countdown logic ─────────────────────────────────────────────
const countdown = ref<number | null>(null);
let timer: ReturnType<typeof setInterval> | null = null;
let startFired = false;

function clearTimer() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

function startCountdown() {
  clearTimer();
  startFired = false;
  countdown.value = COUNTDOWN_SECONDS;
  timer = setInterval(() => {
    if (countdown.value === null) {
      clearTimer();
      return;
    }
    countdown.value -= 1;
    if (countdown.value <= 0) {
      clearTimer();
      if (!startFired && props.isHost) {
        startFired = true;
        emit("start");
      }
    }
  }, 1000);
}

function handleStart() {
  if (!canStart.value || props.isStarting) return;
  clearTimer();
  if (!startFired) {
    startFired = true;
    emit("start");
  }
}

watch(canStart, (now) => {
  if (now) {
    startCountdown();
  } else {
    clearTimer();
    countdown.value = null;
    startFired = false;
  }
});

onBeforeUnmount(() => {
  clearTimer();
});

// ── State labels + visual treatment ─────────────────────────────
const stateLabel = computed(() => {
  if (!enoughPlayers.value) {
    const need = Math.max(0, 3 - props.players.length);
    return `NEED ${need} MORE`;
  }
  if (!allNonBotsReady.value) return "WAITING FOR READY";
  if (countdown.value !== null && countdown.value > 0) return `STARTING IN ${countdown.value}`;
  return "DEALING CARDS…";
});

const stateSubLabel = computed(() => {
  if (!enoughPlayers.value) return "At least 3 players required";
  if (!allNonBotsReady.value) return `${readyCount.value}/${props.players.length} ready`;
  return "Press cancel to stop auto-start";
});

const ringColor = computed(() => canStart.value ? "var(--lb-accent-lime)" : "var(--lb-accent)");

const ringDash = computed(() => {
  if (props.maxSeats <= 0) return 0;
  const pct = Math.min(1, props.players.length / props.maxSeats);
  return pct * 126;
});

const panelStyle = computed(() => {
  if (canStart.value) {
    return {
      borderColor: "var(--lb-accent-lime)",
      boxShadow: "0 0 40px -10px var(--lb-accent-lime)",
    };
  }
  if (enoughPlayers.value) {
    return {
      borderColor: "var(--lb-accent)",
      boxShadow: "0 0 30px -15px var(--lb-accent)",
    };
  }
  return {
    borderColor: "var(--lb-line-strong)",
    boxShadow: "none",
  };
});
</script>

<style scoped>
.lobby-startbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  margin: 0 20px 18px;
  flex-shrink: 0;
  flex-wrap: wrap;
  transition: border-color 240ms ease, box-shadow 240ms ease;
}

.lsb-state {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.lsb-ring {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.lsb-ring-count {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Archivo Black', sans-serif;
  font-size: 13px;
  color: var(--lb-ink);
}

.lsb-ring-count span {
  color: var(--lb-ink-muted);
  font-size: 11px;
  margin-left: 1px;
}

.lsb-labels {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.lsb-label-main {
  font-family: 'Archivo Black', sans-serif;
  font-size: 18px;
  letter-spacing: 0.03em;
  color: var(--lb-ink);
  line-height: 1;
}

.lsb-label-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--lb-ink-muted);
  line-height: 1;
}

.lsb-spacer { flex: 1; }

.lsb-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.lsb-btn {
  padding: 8px 12px;
  font-size: 11px;
}

.lsb-btn--start {
  padding: 10px 14px;
}

.lsb-waiting-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--lb-ink-muted);
}
</style>
