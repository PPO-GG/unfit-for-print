<script setup lang="ts">
import { computed, ref } from "vue";
import { useParallax } from "@vueuse/core";
import type { CardTexts } from "~/types/gamecards";
import { SFX } from "~/config/sfx.config";

interface Props {
  mode: "select" | "judge";
  // Select mode
  cards: string[];
  maxPicks: number;
  selectedCards: string[];
  // Judge mode
  submissions: Record<string, string[]>;
  revealedCards: Record<string, boolean>;
  isJudge: boolean;
  allRevealed: boolean;
  // Shared
  cardTexts: CardTexts;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  select: [cardId: string];
  reveal: [playerId: string];
  "pick-winner": [playerId: string];
}>();

// ── Pick color palette (shared with MobileSelectionSlots) ──────────────────────
const PICK_COLORS = ["#3b82f6", "#22c55e", "#f59e0b"];

// ── Select mode helpers ────────────────────────────────────────────────────────

function selectionIndex(cardId: string): number {
  return props.selectedCards.indexOf(cardId);
}

function isSelected(cardId: string): boolean {
  return selectionIndex(cardId) !== -1;
}

function pickColor(cardId: string): string {
  const idx = selectionIndex(cardId);
  return PICK_COLORS[idx] ?? PICK_COLORS[0];
}

function cardStyle(cardId: string) {
  if (!isSelected(cardId)) return {};
  const color = pickColor(cardId);
  return {
    "box-shadow": `0 0 0 3px ${color}, 0 4px 12px rgba(0,0,0,0.25), inset 0 0 60px rgba(0,0,0,0.12)`,
  };
}

// ── Gyroscope tilt ────────────────────────────────────────────────────────────
const listRef = ref<HTMLElement | null>(null);
const { tilt, roll } = useParallax(listRef);

// Clamp to ±3deg (tilt/roll are -0.5 to 0.5, × 6 = ±3deg)
const tiltTransform = computed(
  () =>
    `perspective(800px) rotateX(${(tilt.value * 6).toFixed(2)}deg) rotateY(${(roll.value * 6).toFixed(2)}deg)`,
);

// ── Tap bounce animation ─────────────────────────────────────────────────────
const justTapped = ref(new Set<string>());

function handleSelectTap(cardId: string) {
  emit("select", cardId);
  // Trigger bounce
  justTapped.value.add(cardId);
  setTimeout(() => {
    justTapped.value = new Set(
      [...justTapped.value].filter((id) => id !== cardId),
    );
  }, 300);
}

// ── Judge mode helpers ─────────────────────────────────────────────────────────

const { playSfx } = useSfx();

const submissionEntries = computed(() =>
  Object.entries(props.submissions).map(([playerId, cardIds]) => ({
    playerId,
    cardIds,
    revealed: !!props.revealedCards[playerId],
  })),
);

function handleSubmissionTap(playerId: string, revealed: boolean) {
  if (!props.isJudge) return;
  if (!revealed) {
    playSfx(SFX.cardFlip, { volume: 0.75, pitch: [0.95, 1.05] });
    emit("reveal", playerId);
  } else if (props.allRevealed) {
    emit("pick-winner", playerId);
  }
}
</script>

<template>
  <div ref="listRef" class="mobile-card-list">
    <!-- ── SELECT MODE ─────────────────────────────────────────────────────── -->
    <template v-if="mode === 'select'">
      <div
        v-for="cardId in cards"
        :key="cardId"
        data-testid="select-card"
        :class="[
          'select-card',
          justTapped.has(cardId) && 'select-card--bounce',
        ]"
        :style="{ ...cardStyle(cardId), transform: tiltTransform }"
        @click="handleSelectTap(cardId)"
      >
        <!-- Selection badge (numbered, top-right) -->
        <span
          v-if="isSelected(cardId)"
          data-testid="selection-badge"
          class="selection-badge"
          :style="{ backgroundColor: pickColor(cardId) }"
        >
          {{ selectionIndex(cardId) + 1 }}
        </span>

        <p class="card-text">{{ cardTexts[cardId]?.text }}</p>
      </div>
    </template>

    <!-- ── JUDGE MODE ──────────────────────────────────────────────────────── -->
    <template v-else-if="mode === 'judge'">
      <div
        v-for="entry in submissionEntries"
        :key="entry.playerId"
        data-testid="submission-group"
        class="submission-group"
        :class="
          entry.revealed
            ? 'submission-group--revealed'
            : 'submission-group--hidden'
        "
        :style="entry.revealed ? { transform: tiltTransform } : {}"
        @click="handleSubmissionTap(entry.playerId, entry.revealed)"
      >
        <!-- Unrevealed state -->
        <template v-if="!entry.revealed">
          <p class="reveal-hint">Tap to reveal</p>
        </template>

        <!-- Revealed state: show each card in the submission -->
        <template v-else>
          <div
            v-for="(cardId, i) in entry.cardIds"
            :key="cardId"
            class="submission-card"
            :class="{ 'submission-card--divider': i > 0 }"
          >
            <p class="card-text">{{ cardTexts[cardId]?.text }}</p>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mobile-card-list {
  overflow-y: auto;
  padding: 0.125rem 0.75rem 5rem;
  -webkit-overflow-scrolling: touch;
}

/* ── Shared card base ─────────────────────────────────────────────────────── */
/* ── Tap bounce animation ────────────────────────────────────────────────── */
.select-card--bounce {
  animation: card-tap-bounce 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes card-tap-bounce {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.05) rotate(1.5deg);
  }
  100% {
    transform: scale(1);
  }
}

.select-card:active {
  transform: scale(1.02) !important;
}

.select-card,
.submission-group--revealed {
  background: #e7e1de;
  border-radius: 0.75rem; /* 12px */
  outline: 4px solid rgba(0, 0, 0, 0.15);
  outline-offset: -4px;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.25),
    inset 0 0 60px rgba(0, 0, 0, 0.12);
  margin-bottom: 0.625rem;
  position: relative;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275),
    box-shadow 0.2s ease;
}

/* ── Select card text ─────────────────────────────────────────────────────── */
.select-card .card-text {
  color: #1a1a1a;
  font-size: 1.5rem; /* 15px */
  line-height: 1.5;
  margin: 0;
  padding: 0.875rem 1rem;
}

/* ── Selection badge ──────────────────────────────────────────────────────── */
.selection-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 1.625rem;
  height: 1.625rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 700;
  color: white;
  z-index: 2;
}

/* ── Judge: unrevealed submission ─────────────────────────────────────────── */
.submission-group--hidden {
  background: linear-gradient(135deg, #1c2342 0%, #141b38 100%);
  border-radius: 0.75rem;
  border: 2px dashed rgba(245, 158, 11, 0.6); /* amber dashed */
  margin-bottom: 0.625rem;
  padding: 1.25rem 1rem;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submission-group--hidden .reveal-hint {
  color: rgba(245, 158, 11, 0.8);
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.025em;
}

/* ── Judge: revealed submission ───────────────────────────────────────────── */
.submission-group--revealed {
  padding: 0;
  overflow: hidden;
}

.submission-card {
  padding: 0.875rem 1rem;
}

.submission-card--divider {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.submission-card .card-text {
  color: #1a1a1a;
  font-size: 1.5rem;
  line-height: 1.4;
  margin: 0;
}
</style>
