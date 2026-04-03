<script setup lang="ts">
import { computed } from "vue";
import type { Player } from "~/types/player";

interface Props {
  players: Player[];
  scores: Record<string, number>;
  judgeId: string | null;
  myId: string;
  submissions: Record<string, string[]>;
  phase: string;
}

const props = defineProps<Props>();

const activePlayers = computed(() =>
  props.players.filter((p) => p.playerType !== "spectator"),
);

// Sort: current user first, then judge, then by score descending
const sortedPlayers = computed(() => {
  return [...activePlayers.value].sort((a, b) => {
    if (a.userId === props.myId) return -1;
    if (b.userId === props.myId) return 1;
    if (a.userId === props.judgeId) return -1;
    if (b.userId === props.judgeId) return 1;
    return (props.scores[b.userId] ?? 0) - (props.scores[a.userId] ?? 0);
  });
});

function hasSubmitted(userId: string): boolean {
  return !!props.submissions[userId];
}
</script>

<template>
  <div class="player-strip-container">
    <div class="player-strip">
      <div
        v-for="player in sortedPlayers"
        :key="player.userId"
        :class="[
          'player-chip',
          player.userId === myId && 'player-chip--me',
          player.userId === judgeId && 'player-chip--judge',
          phase === 'submitting' && hasSubmitted(player.userId) && 'player-chip--submitted',
        ]"
      >
        <div class="avatar-wrapper">
          <img
            v-if="player.avatar"
            :src="player.avatar"
            :alt="player.name"
            class="avatar"
          />
          <div v-else class="avatar avatar--placeholder" />
          <span v-if="player.userId === judgeId" class="judge-badge">
            <Icon name="i-solar-gavel-bold" class="w-2.5 h-2.5" />
          </span>
        </div>
        <span class="player-name">{{ player.name.split(' ')[0] }}</span>
        <span class="player-score">{{ scores[player.userId] ?? 0 }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-strip-container {
  flex-shrink: 0;
  padding: 0.375rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.player-strip {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 0.125rem 0;
}

.player-strip::-webkit-scrollbar {
  display: none;
}

.player-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3125rem 0.625rem 0.3125rem 0.3125rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2rem;
  flex-shrink: 0;
  border: 1.5px solid transparent;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.player-chip--me {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.3);
}

.player-chip--judge {
  border-color: rgba(167, 139, 250, 0.4);
}

.player-chip--submitted {
  border-color: rgba(74, 222, 128, 0.3);
}

/* ── Avatar ─────────��────────────────────────────────────── */
.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.avatar {
  width: 1.625rem;
  height: 1.625rem;
  border-radius: 50%;
  object-fit: cover;
}

.avatar--placeholder {
  background: #334155;
}

.judge-badge {
  position: absolute;
  bottom: -2px;
  right: -3px;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  background: #7c3aed;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

/* ── Name & Score ────────────────────────────────────────── */
.player-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #cbd5e1;
  max-width: 5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-score {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #fbbf24;
  min-width: 0.75rem;
  text-align: center;
}
</style>
