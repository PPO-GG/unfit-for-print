<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
  readingAloud?: boolean;
  // Shared
  cardTexts: CardTexts;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  select: [cardId: string];
  reveal: [playerId: string];
  "pick-winner": [playerId: string];
  "read-aloud": [playerId: string];
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

// Play flip SFX for non-judges when cards are revealed via Yjs sync
watch(
  () => props.revealedCards,
  (next, prev) => {
    if (props.isJudge || props.mode !== "judge") return;
    const newReveals = Object.keys(next).filter((k) => next[k] && !prev?.[k]);
    if (newReveals.length) {
      playSfx(SFX.cardFlip, { volume: 0.75, pitch: [0.95, 1.05] });
    }
  },
  { deep: true },
);

function readAloud(playerId: string) {
  emit("read-aloud", playerId);
}
</script>

<template>
  <div class="mobile-card-list">
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
        :style="cardStyle(cardId)"
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
        @click="handleSubmissionTap(entry.playerId, entry.revealed)"
      >
        <!-- Unrevealed state -->
        <template v-if="!entry.revealed">
          <p class="reveal-hint">{{ isJudge ? 'Tap to reveal' : 'Waiting to be revealed' }}</p>
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
          <button
            v-if="isJudge"
            class="speak-btn"
            :class="{ 'speak-btn--speaking': readingAloud }"
            :disabled="readingAloud"
            @click.stop="readAloud(entry.playerId)"
          >
            <Icon
              :name="readingAloud ? 'svg-spinners:pulse-rings-multiple' : 'solar:user-speak-bold-duotone'"
              class="speak-btn-icon"
            />
          </button>
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
  filter: brightness(0.95);
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
  position: relative;
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

/* ── Speak button ─────────────────────────────────────────────────────────── */
.speak-btn {
  position: absolute;
  bottom: 0.35rem;
  right: 0.35rem;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: rgba(245, 158, 11, 0.12);
  border: none;
  color: rgba(245, 158, 11, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.speak-btn:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.3);
  color: rgba(245, 158, 11, 1);
}

.speak-btn:disabled {
  cursor: default;
  opacity: 0.6;
}

.speak-btn--speaking {
  animation: speak-pulse 1.2s ease-in-out infinite;
}

@keyframes speak-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.speak-btn-icon {
  width: 1rem;
  height: 1rem;
}
</style>
