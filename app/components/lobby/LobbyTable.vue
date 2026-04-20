<template>
  <div class="lobby-table-root">
    <!-- Existing scrolling card-back background -->
    <ScrollingBackground :speed-px="40" :disable-on-mobile="false" />

    <!-- Oval table surface -->
    <div class="lobby-table-surface" />

    <!-- Center plate -->
    <div class="lobby-table-center">
      <div class="lobby-chip">
        <span class="live-dot" />
        Waiting for players
      </div>
      <div class="lobby-table-headline">
        GATHER<br />
        <span style="color: var(--lb-accent)">THE DEGENERATES</span>
      </div>
      <div class="lobby-table-sub">
        Round 01 starts when all players are ready
      </div>
    </div>

    <!-- Seats -->
    <LobbySeat
      v-for="(seat, i) in seats"
      :key="seat?.$id ?? 'empty-' + i"
      :player="seat"
      :position-style="seatPositions[i]"
      :is-host-user="isHostUser"
      @add-bot="$emit('add-bot')"
    />
  </div>
</template>

<script lang="ts" setup>
import type { Player } from "~/types/player";

const props = defineProps<{
  players: Player[];
  maxSeats: number;
  isHostUser: boolean;
}>();

defineEmits<{ (e: "add-bot"): void }>();

// Build seat slots: all real players first, then empty slots up to maxSeats.
// If players somehow exceed maxSeats, show everyone — no one gets dropped.
const seats = computed<(Player | null)[]>(() => {
  const filled = props.players.length;
  const total = Math.max(filled, props.maxSeats);
  return Array.from({ length: total }, (_, i) => props.players[i] ?? null);
});

// Trigonometric seat positions — one per actual seat slot so spacing
// stays even regardless of how many players are present.
const seatPositions = computed(() => {
  const total = seats.value.length;
  return Array.from({ length: total }, (_, i) => {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const rx = 42; // oval x-radius %
    const ry = 36; // oval y-radius %
    return {
      left: `${50 + Math.cos(angle) * rx}%`,
      top: `${50 + Math.sin(angle) * ry}%`,
    };
  });
});
</script>

<style scoped>
.lobby-table-root {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.lobby-table-surface {
  position: absolute;
  left: 12%;
  right: 12%;
  top: 10%;
  bottom: 10%;
  background: rgba(10, 13, 28, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 50%;
  pointer-events: none;
}

.lobby-table-center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  z-index: 1;
}

.lobby-table-headline {
  font-family: 'Archivo Black', sans-serif;
  font-size: clamp(28px, 4vw, 52px);
  line-height: 0.88;
  letter-spacing: -0.01em;
  color: var(--lb-ink);
}

.lobby-table-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--lb-ink-muted);
  margin-top: 4px;
}
</style>
