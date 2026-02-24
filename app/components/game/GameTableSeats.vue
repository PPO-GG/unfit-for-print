<script lang="ts" setup>
import { ref, computed } from "vue";
import type { Player } from "~/types/player";

const props = defineProps<{
  players: Player[];
  myId: string;
  submissions: Record<string, string[]>;
  judgeId?: string | null;
  scores?: Record<string, number>;
}>();

const { t } = useI18n();

// ── Participants (excluding self) ───────────────────────────────
const participants = computed(() =>
  props.players.filter(
    (p) => p.playerType !== "spectator" && p.userId !== props.myId,
  ),
);

const MAX_SEATS = 6;
const seatedPlayers = computed(() => participants.value.slice(0, MAX_SEATS));
const overflowPlayers = computed(() => participants.value.slice(MAX_SEATS));

// ── Helpers ─────────────────────────────────────────────────────
function hasSubmitted(playerId: string): boolean {
  return !!props.submissions[playerId];
}

function getPlayerScore(playerId: string): number {
  return props.scores?.[playerId] ?? 0;
}

// ── Seat positioning ────────────────────────────────────────────
function getSeatStyle(index: number, total: number) {
  const fraction = total <= 1 ? 0.5 : index / (total - 1);
  const x = 20 + fraction * 60;
  const arcDepth = 100;
  const yOffset = Math.pow(fraction - 0.5, 2) * 4 * arcDepth;
  return {
    left: `${x}%`,
    top: `${yOffset}px`,
    transform: "translateX(-50%)",
  };
}

// ── Expose seat refs so parent can measure positions for fly-in ──
const seatRefs = ref<Record<string, HTMLElement | null>>({});
defineExpose({ seatRefs });
</script>

<template>
  <!-- Player Seats Arc -->
  <div class="seats-arc">
    <div
      v-for="(player, idx) in seatedPlayers"
      :key="player.userId"
      :ref="
        (el) => {
          if (el) seatRefs[player.userId] = el as HTMLElement;
        }
      "
      class="player-seat"
      :class="{
        'player-seat--submitted': hasSubmitted(player.userId),
        'player-seat--judge': player.userId === props.judgeId,
      }"
      :style="getSeatStyle(idx, seatedPlayers.length)"
    >
      <div class="seat-avatar-ring">
        <!-- Score card badge (top-right, appears on hover) -->
        <div class="score-card-badge">
          <span class="score-card-value">{{
            getPlayerScore(player.userId)
          }}</span>
        </div>

        <!-- Judge gavel badge -->
        <div v-if="player.userId === props.judgeId" class="judge-badge">
          <Icon name="mdi:gavel" />
        </div>

        <!-- Submitted checkmark badge -->
        <div v-if="hasSubmitted(player.userId)" class="seat-check">
          <Icon name="solar:check-circle-bold" />
        </div>

        <UAvatar
          :src="player.avatar || undefined"
          :alt="player.name"
          size="xl"
          class="seat-avatar-img"
        />
      </div>
      <span class="seat-name">{{ player.name }}</span>
    </div>
  </div>

  <!-- Overflow Player List (7+) -->
  <div v-if="overflowPlayers.length > 0" class="overflow-list">
    <div
      v-for="player in overflowPlayers"
      :key="player.userId"
      :ref="
        (el) => {
          if (el) seatRefs[player.userId] = el as HTMLElement;
        }
      "
      class="overflow-player"
      :class="{
        'overflow-player--submitted': hasSubmitted(player.userId),
        'overflow-player--judge': player.userId === props.judgeId,
      }"
    >
      <div class="overflow-avatar-wrap">
        <UAvatar
          :src="player.avatar || undefined"
          :alt="player.name"
          size="sm"
        />
        <div class="overflow-score-badge">
          <span>{{ getPlayerScore(player.userId) }}</span>
        </div>
      </div>
      <span class="overflow-name">{{ player.name }}</span>
      <Icon
        v-if="hasSubmitted(player.userId)"
        name="solar:check-circle-bold"
        class="text-green-400 text-sm"
      />
      <Icon
        v-if="player.userId === props.judgeId"
        name="mdi:gavel"
        class="text-amber-400 text-sm"
      />
    </div>
  </div>
</template>

<style scoped>
/* ── Player Seats Arc (docked to top) ──────────────────────── */
.seats-arc {
  position: fixed;
  top: 110px;
  left: 0;
  width: 100%;
  height: 70px;
  z-index: 40;
  pointer-events: none;
}

.player-seat {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  transition: all 0.3s ease;
  cursor: default;
  pointer-events: auto;
}

/* ── Avatar Ring (thick dark border) ──────────────────────── */
.seat-avatar-ring {
  position: relative;
  border-radius: 50%;
  padding: 4px;
  background: linear-gradient(
    135deg,
    rgba(71, 85, 105, 0.6),
    rgba(30, 41, 59, 0.9)
  );
  box-shadow:
    0 0 0 3px rgba(30, 41, 59, 0.95),
    0 4px 16px rgba(0, 0, 0, 0.3);
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.player-seat:hover .seat-avatar-ring {
  box-shadow:
    0 0 0 3px rgba(51, 65, 85, 0.95),
    0 6px 24px rgba(0, 0, 0, 0.4);
  transform: scale(1.05);
}

.seat-avatar-img {
  width: 48px !important;
  height: 48px !important;
  font-size: 1.35rem;
}

/* ── Submitted ring glow ──────────────────────────────────── */
.player-seat--submitted .seat-avatar-ring {
  background: linear-gradient(
    135deg,
    rgba(34, 197, 94, 0.4),
    rgba(22, 163, 74, 0.25)
  );
  box-shadow:
    0 0 0 3px rgba(34, 197, 94, 0.3),
    0 0 20px rgba(34, 197, 94, 0.15),
    0 4px 16px rgba(0, 0, 0, 0.3);
}

/* ── Judge ring glow ──────────────────────────────────────── */
.player-seat--judge .seat-avatar-ring {
  background: linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.35),
    rgba(217, 119, 6, 0.2)
  );
  box-shadow:
    0 0 0 3px rgba(245, 158, 11, 0.25),
    0 0 18px rgba(245, 158, 11, 0.12),
    0 4px 16px rgba(0, 0, 0, 0.3);
}

/* ── Score Card Badge (top-right, mini playing card) ──────── */
.score-card-badge {
  position: absolute;
  top: -6px;
  right: -10px;
  width: 26px;
  height: 34px;
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border: 1.5px solid rgba(100, 116, 139, 0.4);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(12deg) scale(0);
  transform-origin: bottom left;
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  z-index: 10;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.player-seat:hover .score-card-badge {
  transform: rotate(12deg) scale(1);
  opacity: 1;
}

.score-card-value {
  font-size: 0.85rem;
  color: rgba(241, 245, 249, 0.95);
  letter-spacing: 0.02em;
  line-height: 1;
}

/* ── Judge Badge (bottom-left gavel) ──────────────────────── */
.judge-badge {
  position: absolute;
  bottom: -4px;
  left: -6px;
  width: 28px;
  height: 28px;
  background: rgba(245, 158, 11, 0.25);
  border: 2px solid rgba(245, 158, 11, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  color: #f59e0b;
  z-index: 10;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.25);
  animation: check-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* ── Submitted Check Badge (bottom-right) ─────────────────── */
.seat-check {
  position: absolute;
  bottom: -2px;
  right: -4px;
  width: 24px;
  height: 24px;
  background: rgba(15, 23, 42, 0.9);
  border: 2px solid rgba(34, 197, 94, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  color: #22c55e;
  z-index: 10;
  animation: check-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes check-pop {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

.seat-name {
  font-size: 0.7rem;
  color: rgba(148, 163, 184, 0.9);
  letter-spacing: 0.04em;
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  transition: color 0.3s ease;
}

.player-seat--submitted .seat-name {
  color: rgba(34, 197, 94, 0.9);
}

.player-seat--judge .seat-name {
  color: rgba(245, 158, 11, 0.9);
}

/* ── Overflow List ──────────────────────────────────────────── */
.overflow-list {
  position: fixed;
  top: 152px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  z-index: 40;
  background: rgba(30, 41, 59, 0.4);
  border-radius: 0.75rem;
  max-width: 90%;
}

.overflow-player {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  background: rgba(51, 65, 85, 0.5);
  transition: all 0.3s ease;
  cursor: default;
}

.overflow-player:hover {
  background: rgba(51, 65, 85, 0.7);
}

.overflow-player--submitted {
  background: rgba(34, 197, 94, 0.1);
}

.overflow-player--judge {
  background: rgba(245, 158, 11, 0.1);
}

.overflow-avatar-wrap {
  position: relative;
}

.overflow-score-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border: 1.5px solid rgba(100, 116, 139, 0.4);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  transform: rotate(10deg) scale(0);
  opacity: 0;
  transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  pointer-events: none;

  font-size: 0.65rem;
  color: rgba(241, 245, 249, 0.9);
  z-index: 5;
}

.overflow-player:hover .overflow-score-badge {
  transform: rotate(10deg) scale(1);
  opacity: 1;
}

.overflow-name {
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.8);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
