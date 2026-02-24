<script lang="ts" setup>
import { computed } from "vue";
import type { Player } from "~/types/player";
import type { CardTexts } from "~/types/gamecards";

interface BlackCard {
  id: string;
  text: string;
  pick: number;
  [key: string]: unknown;
}

const props = defineProps<{
  winnerSelected: boolean;
  effectiveRoundWinner?: string | null;
  confirmedRoundWinner?: string | null;
  winningCards?: string[];
  blackCard?: BlackCard | null;
  players: Player[];
  myId: string;
  cardTexts?: CardTexts;
}>();

const { t } = useI18n();

function getPlayerName(playerId: string): string {
  const p = props.players.find(
    (pl) => pl.userId === playerId || pl.$id === playerId,
  );
  return p?.name || t("lobby.unknown_player");
}

const winnerName = computed(() => {
  const winner = props.confirmedRoundWinner || props.effectiveRoundWinner;
  if (!winner) return "";
  if (winner === props.myId) return t("game.you");
  return getPlayerName(winner);
});

const isWinnerSelf = computed(() => {
  const winner = props.confirmedRoundWinner || props.effectiveRoundWinner;
  return winner === props.myId;
});
</script>

<template>
  <Transition name="celebration">
    <div v-if="winnerSelected" class="winner-overlay">
      <div class="winner-overlay-content">
        <h2 class="winner-headline">
          <template v-if="isWinnerSelf">
            {{ t("game.round_won_self") }}
          </template>
          <template v-else>
            {{ t("game.round_won_other", { name: winnerName }) }}
          </template>
        </h2>

        <!-- Winning cards display -->
        <div
          v-if="winningCards && winningCards.length > 0"
          class="winner-cards-display"
        >
          <div v-if="blackCard" class="winner-prompt">
            <BlackCard
              :card-id="blackCard.id"
              :text="blackCard.text"
              :num-pick="blackCard.pick"
              :flipped="false"
            />
          </div>
          <div class="winner-answers">
            <WhiteCard
              v-for="cardId in winningCards"
              :key="cardId"
              :cardId="cardId"
              :text="props.cardTexts?.[cardId]?.text"
              :is-winner="true"
              :flipped="false"
              back-logo-url="/img/ufp.svg"
            />
          </div>
        </div>

        <p class="winner-subtitle">
          {{ t("game.next_round_starting_soon") }}
        </p>
        <div class="winner-progress">
          <UProgress indeterminate color="warning" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ═══ WINNER CELEBRATION OVERLAY ═══ */
.winner-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2, 6, 23, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.winner-overlay-content {
  text-align: center;
  max-width: 700px;
  width: 100%;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.winner-headline {
  font-size: clamp(2.5rem, 8vw, 5rem);
  color: #f59e0b;
  letter-spacing: 0.04em;
  text-shadow:
    0 0 30px rgba(245, 158, 11, 0.4),
    0 0 60px rgba(245, 158, 11, 0.2);
  animation: headline-entrance 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes headline-entrance {
  from {
    opacity: 0;
    transform: scale(0.5) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.winner-cards-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

@media (min-width: 640px) {
  .winner-cards-display {
    flex-direction: row;
    justify-content: center;
    gap: 1.5rem;
  }
}

.winner-prompt {
  flex-shrink: 0;
}

.winner-answers {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.winner-subtitle {
  font-size: 1.2rem;
  color: rgba(148, 163, 184, 0.8);
  letter-spacing: 0.06em;
}

.winner-progress {
  width: 200px;
}

/* ── Celebration Transition ──────────────────────────────────── */
.celebration-enter-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.celebration-leave-active {
  transition: all 0.3s ease;
}

.celebration-enter-from {
  opacity: 0;
  backdrop-filter: blur(0);
}

.celebration-enter-from .winner-headline {
  transform: scale(0.5) translateY(20px);
  opacity: 0;
}

.celebration-leave-to {
  opacity: 0;
}
</style>
