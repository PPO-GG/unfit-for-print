<script setup lang="ts">
import { computed } from "vue";
import type { Player } from "~/types/player";

interface Props {
  round: number;
  players: Player[];
  judgeId: string | null;
  submissions: Record<string, string[]>;
  myAvatar: string;
  phase: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "toggle-sidebar": [];
}>();

const activePlayers = computed(() =>
  props.players.filter((p) => p.playerType === "player" || !p.playerType),
);

function dotColor(player: Player): string {
  if (player.userId === props.judgeId) return "#a78bfa"; // purple — judge
  if (props.submissions[player.userId]) return "#4ade80"; // green — submitted
  return "#475569"; // gray — waiting
}
</script>

<template>
  <div class="mobile-status-bar">
    <!-- Hamburger -->
    <button
      class="hamburger-btn"
      aria-label="Open menu"
      @click="emit('toggle-sidebar')"
    >
      <Icon name="i-solar-hamburger-menu-broken" class="w-5 h-5 text-slate-400" />
    </button>

    <!-- Center: round + player dots -->
    <div class="center-info">
      <span class="round-label">Round {{ round }}</span>
      <div class="player-dots">
        <span
          v-for="player in activePlayers"
          :key="player.userId"
          class="dot"
          :style="{ backgroundColor: dotColor(player) }"
          :title="player.name"
        />
      </div>
    </div>

    <!-- User avatar -->
    <div class="avatar-slot">
      <img
        v-if="myAvatar"
        :src="myAvatar"
        alt="You"
        class="w-6 h-6 rounded-full"
      />
      <div v-else class="w-6 h-6 rounded-full bg-slate-700" />
    </div>
  </div>
</template>

<style scoped>
.mobile-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.875rem;
  height: 2.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  flex-shrink: 0;
}

.hamburger-btn {
  width: 1.75rem;
  height: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
}

.center-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}

.round-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.player-dots {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  transition: background-color 0.3s ease;
}

.avatar-slot {
  width: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
