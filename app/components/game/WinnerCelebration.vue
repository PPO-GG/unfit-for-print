<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { gsap } from "gsap";
import confetti from "canvas-confetti";
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

// ── Refs for GSAP targets ──────────────────────────────────────
const overlayRef = ref<HTMLElement | null>(null);
const headlineRef = ref<HTMLElement | null>(null);
const cardsRef = ref<HTMLElement | null>(null);
const subtitleRef = ref<HTMLElement | null>(null);
const progressRef = ref<HTMLElement | null>(null);

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

// ── Confetti burst ──────────────────────────────────────────────
function fireConfetti() {
  const colors = ["#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#a855f7"];
  const duration = 2500;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();

  // Big center burst
  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { x: 0.5, y: 0.4 },
      colors,
      startVelocity: 35,
      gravity: 0.8,
    });
  }, 300);
}

// ── GSAP Timeline Entrance ──────────────────────────────────────
watch(
  () => props.winnerSelected,
  (selected) => {
    if (!selected) return;

    // Allow one tick for the DOM to render
    nextTick(() => {
      fireConfetti();

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // Overlay backdrop fade
      if (overlayRef.value) {
        tl.fromTo(
          overlayRef.value,
          { opacity: 0, backdropFilter: "blur(0px)" },
          { opacity: 1, backdropFilter: "blur(12px)", duration: 0.4 },
          0,
        );
      }

      // Headline drops in with elastic bounce
      if (headlineRef.value) {
        tl.fromTo(
          headlineRef.value,
          { opacity: 0, y: 40, scale: 0.5, rotationX: -15 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            rotationX: 0,
            duration: 0.7,
            ease: "back.out(1.7)",
          },
          0.15,
        );
      }

      // Cards fan out with stagger
      if (cardsRef.value) {
        const cardEls = cardsRef.value.querySelectorAll(
          ".winner-prompt, .winner-answer-card",
        );
        if (cardEls.length) {
          tl.fromTo(
            cardEls,
            { opacity: 0, y: 30, scale: 0.85, rotation: -5 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              rotation: 0,
              duration: 0.6,
              stagger: 0.12,
              ease: "back.out(1.4)",
            },
            0.4,
          );
        }
      }

      // Subtitle fades in
      if (subtitleRef.value) {
        tl.fromTo(
          subtitleRef.value,
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.5 },
          0.7,
        );
      }

      // Progress bar slides in
      if (progressRef.value) {
        tl.fromTo(
          progressRef.value,
          { opacity: 0, scaleX: 0 },
          { opacity: 1, scaleX: 1, duration: 0.4, ease: "power2.out" },
          0.9,
        );
      }
    });
  },
);
</script>

<template>
  <Transition name="celebration">
    <div v-if="winnerSelected" ref="overlayRef" class="winner-overlay">
      <div class="winner-overlay-content">
        <h2 ref="headlineRef" class="winner-headline">
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
          ref="cardsRef"
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
              class="winner-answer-card"
              :cardId="cardId"
              :text="props.cardTexts?.[cardId]?.text"
              :is-winner="true"
              :flipped="false"
              back-logo-url="/img/ufp.svg"
            />
          </div>
        </div>

        <p ref="subtitleRef" class="winner-subtitle">
          {{ t("game.next_round_starting_soon") }}
        </p>
        <div ref="progressRef" class="winner-progress">
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
  /* Let GSAP handle the entrance — no CSS animation */
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
  transform-origin: center;
}

/* ── Celebration Transition (Vue) ─────────────────────────── */
/* Keep these minimal — GSAP handles the entrance animation.
   These are only used for the container mount/unmount. */
.celebration-enter-active {
  /* GSAP takes over via the watcher */
  transition: none;
}

.celebration-leave-active {
  transition: all 0.3s ease;
}

.celebration-enter-from {
  opacity: 0;
}

.celebration-leave-to {
  opacity: 0;
}
</style>
