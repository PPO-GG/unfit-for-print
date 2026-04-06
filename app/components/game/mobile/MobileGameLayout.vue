<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Player } from "~/types/player";
import type { CardTexts } from "~/types/gamecards";
import MobileStatusBar from "~/components/game/mobile/MobileStatusBar.vue";
import MobilePlayerStrip from "~/components/game/mobile/MobilePlayerStrip.vue";
import MobileBlackCard from "~/components/game/mobile/MobileBlackCard.vue";
import MobileSelectionSlots from "~/components/game/mobile/MobileSelectionSlots.vue";
import MobileCardList from "~/components/game/mobile/MobileCardList.vue";
import MobileActionBar from "~/components/game/mobile/MobileActionBar.vue";
import { mergeCardText } from "~/composables/useMergeCards";
import { SFX } from "~/config/sfx.config";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  phase: string;
  blackCard: { id: string; text: string; pick: number } | null;
  myHand: string[];
  mySubmission: string[] | null;
  submissions: Record<string, string[]>;
  revealedCards: Record<string, boolean>;
  scores: Record<string, number>;
  myId: string;
  isJudge: boolean;
  isHost: boolean;
  isParticipant: boolean;
  isSpectator: boolean;
  players: Player[];
  judgeId: string | null;
  cardTexts: CardTexts;
  effectiveRoundWinner: string | null;
  confirmedRoundWinner: string | null;
  winnerSelected: boolean;
  winningCards: string[];
  round: number;
  readingAloud: boolean;
  myAvatar: string;
}

const props = defineProps<Props>();

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  "select-cards": [cardIds: string[]];
  "reveal-card": [playerId: string];
  "select-winner": [playerId: string];
  "read-aloud": [text: string];
  "toggle-sidebar": [];
  continue: [];
}>();

// ── Internal State ────────────────────────────────────────────────────────────

const selectedCards = ref<string[]>([]);

// Reset selection when phase changes
watch(
  () => props.phase,
  () => {
    selectedCards.value = [];
  },
);

// ── Computed ──────────────────────────────────────────────────────────────────

const pick = computed(() => props.blackCard?.pick ?? 1);

const hasSubmitted = computed(() => props.mySubmission !== null);

const selectedTexts = computed(() =>
  selectedCards.value.map((id) => props.cardTexts[id]?.text ?? ""),
);

const allRevealed = computed(() => {
  const keys = Object.keys(props.submissions);
  if (keys.length === 0) return false;
  return keys.every((key) => props.revealedCards[key] === true);
});

const activePlayers = computed(() =>
  props.players.filter((p) => p.playerType === "player" || !p.playerType),
);

const playersWaiting = computed(() => {
  const active = activePlayers.value.filter((p) => p.userId !== props.judgeId);
  const submitted = Object.keys(props.submissions).length;
  return Math.max(0, active.length - submitted);
});

// Whether the middle area shows the hand selection UI
const showHandSelection = computed(
  () => props.phase === "submitting" && !props.isJudge && !hasSubmitted.value,
);

// Unified winner screen — shown as soon as a winner is picked
const showWinner = computed(
  () => !!props.effectiveRoundWinner || !!props.confirmedRoundWinner,
);

// Winner name resolved from players list (works for both highlight + celebration)
const winnerName = computed(() => {
  const id = props.confirmedRoundWinner || props.effectiveRoundWinner;
  if (!id) return null;
  return props.players.find((p) => p.userId === id)?.name ?? null;
});

// Winner's cards — prefer winningCards (from confirmed state), fall back to submissions
const winnerCards = computed(() => {
  if (props.winningCards.length > 0) return props.winningCards;
  const id = props.effectiveRoundWinner;
  if (!id) return [];
  return props.submissions[id] ?? [];
});

// Revealed count for judging status line
const revealedCount = computed(
  () => Object.values(props.revealedCards).filter(Boolean).length,
);

const totalSubmissions = computed(() => Object.keys(props.submissions).length);

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleReadAloud(playerId: string) {
  if (!import.meta.client) return;
  const sub = props.submissions[playerId];
  if (!sub || !props.blackCard) return;

  // Resolve any card texts missing from the shared cardTexts map
  const missingIds = sub.filter((cardId) => !props.cardTexts[cardId]?.text);
  let resolvedTexts: Record<string, { text: string; pack: string }> = {};
  if (missingIds.length > 0) {
    try {
      resolvedTexts = await $fetch("/api/cards/resolve", {
        method: "POST",
        body: { cardIds: missingIds },
      });
    } catch (err) {
      console.error("[ReadAloud] Failed to resolve card texts:", err);
    }
  }

  const whiteTexts = sub.map(
    (cardId) =>
      props.cardTexts[cardId]?.text ?? resolvedTexts[cardId]?.text ?? "",
  );
  const merged = mergeCardText(props.blackCard.text, whiteTexts);
  if (merged) emit("read-aloud", merged);
}

function handleCardSelect(cardId: string) {
  const idx = selectedCards.value.indexOf(cardId);
  if (idx !== -1) {
    selectedCards.value = selectedCards.value.filter((id) => id !== cardId);
  } else if (selectedCards.value.length < pick.value) {
    selectedCards.value = [...selectedCards.value, cardId];
  }
}

function handleSlotDeselect(index: number) {
  selectedCards.value = selectedCards.value.filter((_, i) => i !== index);
}

const { playSfx } = useSfx();

function handleSubmit() {
  emit("select-cards", selectedCards.value);
  selectedCards.value = [];
  playSfx(SFX.cardThrow);
}

// ── Confetti ──────────────────────────────────────────────────────────────────

watch(
  () => props.effectiveRoundWinner,
  async (winnerId) => {
    if (!winnerId || typeof window === "undefined") return;
    try {
      const { default: confetti } = await import("canvas-confetti");
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { x: 0.5, y: 0.4 },
        startVelocity: 25,
        gravity: 0.8,
      });
      if (winnerId === props.myId) {
        setTimeout(
          () =>
            confetti({
              particleCount: 50,
              angle: 55,
              spread: 60,
              startVelocity: 40,
              origin: { x: 0.05, y: 0.95 },
            }),
          200,
        );
      }
    } catch {
      // canvas-confetti not available (e.g. SSR or missing package)
    }
  },
);
</script>

<template>
  <div class="mobile-game-layout">
    <!-- ── Status Bar ────────────────────────────────────────────────────── -->
    <MobileStatusBar
      :round="round"
      :phase="phase"
      :my-avatar="myAvatar"
      @toggle-sidebar="emit('toggle-sidebar')"
    />

    <!-- ── Player Strip ─────────────────────────────────────────────────── -->
    <MobilePlayerStrip
      :players="players"
      :scores="scores"
      :judge-id="judgeId"
      :my-id="myId"
      :submissions="submissions"
      :phase="phase"
    />

    <!-- ── Black Card (pinned) ───────────────────────────────────────────── -->
    <MobileBlackCard
      v-if="blackCard"
      :text="blackCard.text"
      :pick="blackCard.pick"
      :selected-texts="showHandSelection ? selectedTexts : []"
      :players-waiting="playersWaiting"
    />

    <!-- ── Middle Area ───────────────────────────────────────────────────── -->
    <div class="middle-area">
      <!-- SUBMITTING — non-judge, not yet submitted: selection slots + hand -->
      <template v-if="showHandSelection">
        <MobileSelectionSlots
          v-if="pick > 1"
          :required-picks="pick"
          :selected-texts="selectedTexts"
          @deselect="handleSlotDeselect"
        />
        <MobileCardList
          mode="select"
          :cards="myHand"
          :max-picks="pick"
          :selected-cards="selectedCards"
          :card-texts="cardTexts"
          :submissions="{}"
          :revealed-cards="{}"
          :is-judge="false"
          :all-revealed="false"
          @select="handleCardSelect"
        />
      </template>

      <!-- SUBMITTING — non-judge, already submitted -->
      <template v-else-if="phase === 'submitting' && !isJudge && hasSubmitted">
        <div class="center-state">
          <Icon
            name="i-solar-check-circle-bold"
            class="state-icon state-icon--green"
          />
          <p class="state-title">Cards submitted!</p>
          <p v-if="playersWaiting > 0" class="state-subtitle">
            Waiting for {{ playersWaiting }} player{{
              playersWaiting > 1 ? "s" : ""
            }}…
          </p>
        </div>
      </template>

      <!-- SUBMITTING — judge view -->
      <template v-else-if="phase === 'submitting' && isJudge">
        <div class="center-state">
          <Icon
            name="i-solar-gavel-bold"
            class="state-icon state-icon--purple"
          />
          <p class="state-title">Waiting for players...</p>
          <p v-if="playersWaiting > 0" class="state-subtitle">
            {{ playersWaiting }} player{{ playersWaiting > 1 ? "s" : "" }} still
            submitting
          </p>
        </div>
      </template>

      <!-- JUDGING -->
      <template v-else-if="phase === 'judging'">
        <p v-if="isJudge && !allRevealed" class="judging-hint">
          Tap to reveal · {{ revealedCount }} of {{ totalSubmissions }} revealed
        </p>
        <MobileCardList
          mode="judge"
          :cards="[]"
          :max-picks="1"
          :selected-cards="[]"
          :card-texts="cardTexts"
          :submissions="submissions"
          :revealed-cards="revealedCards"
          :is-judge="isJudge"
          :all-revealed="allRevealed"
          :reading-aloud="readingAloud"
          @reveal="(pid) => emit('reveal-card', pid)"
          @pick-winner="(pid) => emit('select-winner', pid)"
          @read-aloud="handleReadAloud"
        />
      </template>

      <!-- WINNER — unified screen from the moment a winner is picked -->
      <template v-else-if="showWinner">
        <div class="winner-screen">
          <p class="winner-label">Winner!</p>
          <p v-if="winnerName" class="winner-name">{{ winnerName }}</p>
          <div class="winning-cards">
            <div
              v-for="cardId in winnerCards"
              :key="cardId"
              class="winning-card"
            >
              <p class="winning-card__text">{{ cardTexts[cardId]?.text }}</p>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ── Action Bar (bottom) ───────────────────────────────────────────── -->
    <MobileActionBar
      :phase="phase"
      :is-judge="isJudge"
      :selected-count="selectedCards.length"
      :required-count="pick"
      :all-revealed="allRevealed"
      :has-submitted="hasSubmitted"
      :winner-selected="winnerSelected"
      @submit="handleSubmit"
      @continue="emit('continue')"
    />
  </div>
</template>

<style scoped>
.mobile-game-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100vw;
  min-width: 0;
  height: 100vh;
  height: 100dvh;
  background: #0f172a;
  overflow: hidden;
}

/* ── Middle area ──────────────────────────────────────────────────────────── */
.middle-area {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
}

/* ── Center states (submitted / judge waiting) ────────────────────────────── */
.center-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
}

.state-icon {
  width: 3.5rem;
  height: 3.5rem;
  margin-bottom: 0.25rem;
}

.state-icon--green {
  color: #4ade80;
}

.state-icon--purple {
  color: #a78bfa;
}

.state-title {
  color: #e2e8f0;
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0;
}

.state-subtitle {
  color: #64748b;
  font-size: 1rem;
  margin: 0;
}

/* ── Judging hint ─────────────────────────────────────────────────────────── */
.judging-hint {
  color: #f59e0b;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  padding: 0.625rem 1rem 0.375rem;
  margin: 0;
  flex-shrink: 0;
}

/* ── Winner screen ────────────────────────────────────────────────────────── */
.winner-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.5rem 1rem 6rem;
  animation: winner-fade-in 0.4s ease-out;
}

@keyframes winner-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.winner-label {
  color: #fbbf24;
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.winner-name {
  color: #e2e8f0;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.winning-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  max-width: 22rem;
}

.winning-card {
  background: #e7e1de;
  border-radius: 0.75rem;
  padding: 1rem;
  box-shadow:
    0 0 0 3px #4ade80,
    0 8px 24px rgba(74, 222, 128, 0.25);
  animation: win-glow 1.5s ease-in-out infinite alternate;
}

.winning-card__text {
  color: #1a1a1a;
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1.4;
  margin: 0;
}

@keyframes win-glow {
  from {
    box-shadow:
      0 0 0 3px #4ade80,
      0 8px 24px rgba(74, 222, 128, 0.25);
  }
  to {
    box-shadow:
      0 0 0 3px #4ade80,
      0 8px 32px rgba(74, 222, 128, 0.5);
  }
}
</style>
