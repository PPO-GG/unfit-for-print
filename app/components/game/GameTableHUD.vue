<script lang="ts" setup>
import { computed } from "vue";
import type { Player } from "~/types/player";

const props = defineProps<{
  players: Player[];
  myId: string;
  submissions: Record<string, string[]>;
  isJudge: boolean;
  isSubmitting: boolean;
  isParticipant: boolean;
  scores?: Record<string, number>;
  playMode: "click" | "instant" | "gesture";
}>();

const emit = defineEmits<{
  (e: "cycle-mode"): void;
}>();

const { t } = useI18n();

const currentPlayer = computed(() =>
  props.players.find((p) => p.userId === props.myId),
);

const submissionCount = computed(() => Object.keys(props.submissions).length);
const totalParticipants = computed(
  () => props.players.filter((p) => p.playerType !== "spectator").length - 1,
);

function getPlayerScore(playerId: string): number {
  return props.scores?.[playerId] ?? 0;
}

// ── Position rankings (dense rank — ties share the same position) ──
const myPosition = computed(() => {
  const allPlayers = props.players.filter((p) => p.playerType !== "spectator");
  const ranked = allPlayers
    .map((p) => ({ id: p.userId, score: getPlayerScore(p.userId) }))
    .sort((a, b) => b.score - a.score);

  let position = 1;
  for (let i = 0; i < ranked.length; i++) {
    if (i > 0 && ranked[i]!.score < ranked[i - 1]!.score) {
      position = i + 1;
    }
    if (ranked[i]!.id === props.myId) return position;
  }
  return 0;
});

const totalRanked = computed(
  () => props.players.filter((p) => p.playerType !== "spectator").length,
);

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"] as const;
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function getPositionColorClass(position: number): string {
  switch (position) {
    case 1:
      return "my-position--gold";
    case 2:
      return "my-position--silver";
    case 3:
      return "my-position--bronze";
    default:
      return "my-position--muted";
  }
}
</script>

<template>
  <!-- Bottom-left status stack (status text + score widget) -->
  <div class="bottom-left-stack">
    <!-- Status indicators (above score widget) -->
    <div v-if="isSubmitting" class="status-indicators">
      <div v-if="isJudge" class="judge-banner">
        <Icon name="mdi:gavel" class="text-amber-400 text-lg" />
        <span>{{ t("game.you_are_judge") }}</span>
      </div>

      <div v-if="!isJudge && submissions[myId]" class="submitted-message">
        <Icon name="solar:check-circle-bold" class="text-green-400 text-base" />
        <span>{{ t("game.you_submitted") }}</span>
      </div>

      <p class="pile-counter">
        {{ submissionCount }} / {{ totalParticipants }}
        <span class="pile-counter-label">{{ t("game.player_submitted") }}</span>
      </p>
    </div>

    <!-- My Score Widget -->
    <div v-if="currentPlayer && isParticipant" class="my-score-widget">
      <div class="my-score-avatar">
        <UAvatar
          :src="currentPlayer.avatar || undefined"
          :alt="currentPlayer.name"
          size="sm"
        />
      </div>
      <div class="my-score-info">
        <span class="my-score-name">{{ currentPlayer.name }}</span>
        <span class="my-score-role">
          <Icon v-if="isJudge" name="mdi:gavel" class="text-amber-400" />
          {{ isJudge ? t("game.role_judge") : t("game.role_player") }}
          <span
            v-if="myPosition"
            class="my-position-pill"
            :class="getPositionColorClass(myPosition)"
          >
            {{ getOrdinal(myPosition) }}
          </span>
        </span>
      </div>
      <div class="my-score-value-card">
        <span class="my-score-value">{{ getPlayerScore(myId) }}</span>
      </div>
    </div>
  </div>

  <!-- Play Mode Toggle (fixed, next to My Score) -->
  <button
    v-if="currentPlayer && isParticipant && !isJudge && isSubmitting"
    class="play-mode-toggle"
    :title="t('game.play_mode')"
    @click.stop="emit('cycle-mode')"
  >
    <Icon
      :name="
        playMode === 'click'
          ? 'solar:cursor-bold'
          : playMode === 'instant'
            ? 'solar:bolt-bold'
            : 'solar:hand-shake-bold'
      "
      class="play-mode-icon"
    />
    <span class="play-mode-label">{{
      playMode === "click"
        ? t("game.play_mode_click")
        : playMode === "instant"
          ? t("game.play_mode_instant")
          : t("game.play_mode_gesture")
    }}</span>
  </button>
</template>

<style scoped>
/* ── Bottom-left status stack ────────────────────────────── */
.bottom-left-stack {
  position: fixed;
  bottom: 1.25rem;
  left: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  z-index: 60;
}

.status-indicators {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
}

.judge-banner {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.85rem;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 9999px;

  font-size: 0.85rem;
  letter-spacing: 0.04em;
  color: rgba(245, 158, 11, 0.9);
  text-transform: uppercase;
}

/* ── My Score Widget (bottom-left) ───────────────────────── */
.my-score-widget {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.5rem 0.75rem;
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.85),
    rgba(15, 23, 42, 0.92)
  );
  border: 1px solid rgba(100, 116, 139, 0.2);
  border-radius: 14px;
  backdrop-filter: blur(12px);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  transition: all 0.3s ease;
}

.my-score-widget:hover {
  border-color: rgba(100, 116, 139, 0.35);
  box-shadow:
    0 6px 28px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transform: translateY(-2px);
}

.my-score-avatar {
  flex-shrink: 0;
}

.my-score-info {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.my-score-name {
  font-size: 0.95rem;
  color: rgba(241, 245, 249, 0.95);
  letter-spacing: 0.03em;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100px;
}

.my-score-role {
  font-size: 0.7rem;
  color: rgba(148, 163, 184, 0.7);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.my-score-value-card {
  width: 38px;
  height: 50px;
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border: 2px solid rgba(100, 116, 139, 0.4);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
  flex-shrink: 0;
  transform: rotate(6deg);
}

.my-score-value {
  font-size: 1.3rem;
  color: rgba(241, 245, 249, 0.95);
  letter-spacing: 0.02em;
  line-height: 1;
}

/* ── Play Mode Toggle (fixed, next to My Score) ────────────── */
.play-mode-toggle {
  position: fixed;
  bottom: 1.25rem;
  left: 14rem;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.85rem;
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.85),
    rgba(15, 23, 42, 0.92)
  );
  border: 1px solid rgba(100, 116, 139, 0.2);
  border-radius: 9999px;
  backdrop-filter: blur(12px);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
}

.play-mode-toggle:hover {
  border-color: rgba(100, 116, 139, 0.35);
  box-shadow:
    0 6px 28px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transform: translateY(-1px);
}

.play-mode-icon {
  font-size: 1rem;
  color: rgba(148, 163, 184, 0.9);
}

.play-mode-label {
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  color: rgba(148, 163, 184, 0.9);
  text-transform: uppercase;
}

/* ── Position Pill (inline with role) ────────────────────── */
.my-position-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.05rem 0.4rem;
  border-radius: 9999px;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  line-height: 1.2;
  margin-left: 0.3rem;
  border: 1px solid;
  vertical-align: middle;
}

.my-position--gold {
  background: linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.85),
    rgba(234, 179, 8, 0.9)
  );
  border-color: rgba(253, 224, 71, 0.6);
  color: #451a03;
}

.my-position--silver {
  background: linear-gradient(
    135deg,
    rgba(148, 163, 184, 0.8),
    rgba(203, 213, 225, 0.85)
  );
  border-color: rgba(226, 232, 240, 0.5);
  color: #1e293b;
}

.my-position--bronze {
  background: linear-gradient(
    135deg,
    rgba(180, 120, 60, 0.8),
    rgba(205, 150, 85, 0.85)
  );
  border-color: rgba(217, 175, 120, 0.5);
  color: #3b1e08;
}

.my-position--muted {
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.85),
    rgba(15, 23, 42, 0.9)
  );
  border-color: rgba(100, 116, 139, 0.3);
  color: rgba(148, 163, 184, 0.7);
}
</style>
