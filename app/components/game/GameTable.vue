<script lang="ts" setup>
import { ref, computed, watch, onMounted } from "vue";
import type { Player } from "~/types/player";
import type { CardTexts } from "~/types/gamecards";
import { gsap } from "gsap";
import { mergeCardText } from "~/composables/useMergeCards";
import { getJudgingCardScale } from "~/composables/useJudgingDensity";
import { useCardPlayPreferences } from "~/composables/useCardPlayPreferences";
import { useCardPileChoreography } from "~/composables/useCardPileChoreography";
import { useJudgingFlip, type Submission } from "~/composables/useJudgingFlip";
import { useWinnerTableCelebration } from "~/composables/useWinnerTableCelebration";
import { useSfx } from "~/composables/useSfx";
import { SFX } from "~/config/sfx.config";
import { isNewPrompt, isLegacyRoundStart } from "~/utils/roundBoundary";
import ScoreFlyBadge from "./ScoreFlyBadge.vue";

interface BlackCard {
  id: string;
  text: string;
  pick: number;
  [key: string]: unknown;
}

const props = withDefaults(
  defineProps<{
    isJudge: boolean;
    submissions: Record<string, string[]>;
    myId: string;
    blackCard?: BlackCard | null;
    myHand?: string[];
    isParticipant: boolean;
    isSpectator: boolean;
    isHost: boolean;
    players: Player[];
    phase: "submitting" | "judging";
    /** Bumped whenever a new prompt hits the table. Undefined on legacy docs. */
    promptSerial?: number;
    /** Whether the judge has already spent their one skip this round. */
    blackSkipUsed?: boolean;
    revealedCards: Record<string, boolean>;
    effectiveRoundWinner?: string | null;
    confirmedRoundWinner?: string | null;
    winnerSelected: boolean;
    winningCards?: string[];
    scores?: Record<string, number>;
    judgeId?: string | null;
    /** Whether the TTS engine is currently speaking (driven by parent). */
    readingAloud?: boolean;
    /** Resolved card texts keyed by card ID — eliminates per-card fetches. */
    cardTexts?: CardTexts;
  }>(),
  {
    blackCard: null,
    myHand: () => [],
    effectiveRoundWinner: null,
    confirmedRoundWinner: null,
    winnerSelected: false,
    winningCards: () => [],
    scores: () => ({}),
    judgeId: null,
    readingAloud: false,
    cardTexts: () => ({}),
  },
);

const emit = defineEmits([
  "select-cards",
  "convert-to-player",
  "select-winner",
  "reveal-card",
  "read-aloud",
  "skip-player",
  "skip-prompt",
]);

const { t } = useI18n();
const { playMode, cycleMode } = useCardPlayPreferences();
const { playSfx } = useSfx();

// ── Element refs shared with the animation composables ──────────
const tableRef = ref<HTMLElement | null>(null);
const cardContainerRef = ref<HTMLElement | null>(null);
const ghostTemplateRef = ref<HTMLElement | null>(null);
const gridCellRefs = ref<Record<string, HTMLElement | null>>({});

// ── Phase ───────────────────────────────────────────────────────
// We delay the transition to "judging" locally so the final submission
// animation has time to physically land in the pile before the FLIP layout change.
const localPhase = ref(props.phase);
watch(
  () => props.phase,
  (newPhase, oldPhase) => {
    if (newPhase === "judging" && oldPhase === "submitting") {
      setTimeout(() => {
        localPhase.value = newPhase;
      }, 1000); // 1-second delay for the final card fly-in
    } else {
      localPhase.value = newPhase;
    }
  },
  { immediate: true },
);

const isSubmitting = computed(() => localPhase.value === "submitting");
const isJudging = computed(() => localPhase.value === "judging");

// ── Animation composables ───────────────────────────────────────
const {
  peekCardAngle,
  getPileCardStyle,
  flyOptimisticSubmission,
  flyPileCardsHome,
  adoptExistingSubmissions,
  resetForNewRound: resetPile,
} = useCardPileChoreography({
  submissions: () => props.submissions,
  myId: () => props.myId,
  isSubmitting: () => isSubmitting.value,
  cardContainerRef,
  ghostTemplateRef,
});

const { shuffledOrder, hasTransitionedToRow, showJudgingUI } = useJudgingFlip({
  submissions: () => props.submissions,
  phase: () => localPhase.value,
  cardContainerRef,
  gridCellRefs,
  peekCardAngle,
});

const {
  scoreFly,
  winnerAnimating,
  resetForNewRound: resetCelebration,
} = useWinnerTableCelebration({
  effectiveRoundWinner: () => props.effectiveRoundWinner,
  winnerSelected: () => props.winnerSelected,
  myId: () => props.myId,
  hasTransitionedToRow: () => hasTransitionedToRow.value,
  cardContainerRef,
  gridCellRefs,
});

// ── Round boundary ──────────────────────────────────────────────
// A new prompt on the table is the real reset signal. It used to be inferred
// from the judging → submitting phase edge, but a judge skipping a black card
// swaps the prompt without any phase change at all, so the edge cannot see it.
// `promptSerial` states the fact directly, and because only the engine ever
// increments it, the transient submissions re-parses that ruled out watching
// `submissions` cannot trigger it either.
watch(
  () => props.promptSerial,
  (next, prev) => {
    if (!isNewPrompt(next, prev)) return;
    resetPile();
    resetCelebration();
  },
);

// Legacy docs (created before black-card skipping shipped) carry no serial.
// Keep the old phase edge alive for them so a game in flight across the deploy
// does not lose its round boundary entirely.
watch(
  () => props.phase,
  (newPhase, oldPhase) => {
    if (!isLegacyRoundStart(props.promptSerial, newPhase, oldPhase)) return;
    resetPile();
    resetCelebration();
  },
);

// promptSerial also moves on a normal round advance; only a skip should
// announce itself. blackSkipUsed is true only between a skip and the next
// nextRound, so pairing them isolates the skip.
const skipAnnounceSerial = computed(() =>
  props.blackSkipUsed ? props.promptSerial : undefined,
);

// The flight has to be launched while the pile cards are still mounted: the
// engine's skip clears `submissions` inside its transact, which unmounts them
// before their positions could be measured. Hence fly first, emit second.
function onSkipPrompt() {
  flyPileCardsHome(Object.keys(props.submissions));
  emit("skip-prompt");
}

// The skip control itself lives next to the prompt card in GameBoard, where
// the judge is already looking. The ordering above still has to happen here,
// though — the pile is this component's, and only it can measure the cards
// before they unmount — so GameBoard drives the skip through this method
// rather than calling the engine directly.
defineExpose({ skipPrompt: onSkipPrompt });

onMounted(() => {
  // Existing submissions (hot reload, late join, refresh) must appear in the
  // pile without replaying their fly-in animations.
  adoptExistingSubmissions(localPhase.value === "submitting");
});

// ── Derived state ───────────────────────────────────────────────
const submissionCount = computed(() => Object.keys(props.submissions).length);
const totalParticipants = computed(
  () => props.players.filter((p) => p.playerType !== "spectator").length - 1,
);

const displaySubmissions = computed<Submission[]>(() => {
  if (isJudging.value && shuffledOrder.value.length > 0) {
    return shuffledOrder.value;
  }
  // During submission show all players' submissions
  return Object.entries(props.submissions).map(([playerId, cards]) => ({
    playerId,
    cards,
  }));
});

const totalSubmittedCards = computed(() =>
  displaySubmissions.value.reduce(
    (total, submission) => total + submission.cards.length,
    0,
  ),
);

const judgingCardScale = computed(() =>
  getJudgingCardScale(
    displaySubmissions.value.length,
    totalSubmittedCards.value,
  ),
);

// Preserve the existing compact group spacing as density increases.
const densityClass = computed(() => {
  const density = Math.max(
    displaySubmissions.value.length,
    totalSubmittedCards.value,
  );
  if (density <= 4) return "";
  if (density <= 6) return "judging-grid--medium";
  if (density <= 8) return "judging-grid--dense";
  return "judging-grid--very-dense";
});

function isRevealed(playerId: string): boolean {
  return !!props.revealedCards?.[playerId];
}

const allRevealed = computed(() =>
  displaySubmissions.value.every((sub) => props.revealedCards?.[sub.playerId]),
);

// ── Reveal flash: detect newly revealed cards ────────────────────
const justRevealed = ref<string | null>(null);
watch(
  () => props.revealedCards,
  (newVal, oldVal) => {
    if (!newVal) return;
    for (const id of Object.keys(newVal)) {
      if (oldVal?.[id]) continue;
      justRevealed.value = id;
      setTimeout(() => {
        if (justRevealed.value === id) justRevealed.value = null;
      }, 600);
      // Play flip whoosh SFX
      playSfx(SFX.cardFlip, { volume: [0.4, 0.6], pitch: [0.95, 1.05] });
    }
  },
  { deep: true },
);

// ── "All submitted" pulse: fire when every participant has submitted ──
const allSubmittedDuringPhase = computed(
  () =>
    localPhase.value === "submitting" &&
    submissionCount.value > 0 &&
    submissionCount.value >= totalParticipants.value,
);

watch(allSubmittedDuringPhase, (allIn) => {
  if (!allIn) return;
  const zone = cardContainerRef.value;
  if (!zone) return;
  gsap.fromTo(
    zone,
    { boxShadow: "0 0 0 rgba(139, 92, 246, 0)" },
    {
      boxShadow: "0 0 40px rgba(139, 92, 246, 0.2)",
      duration: 0.4,
      yoyo: true,
      repeat: 1,
      ease: "power2.inOut",
    },
  );
});

/**
 * Read a submission's merged card combination aloud for everyone.
 * Emits an event to the parent (GameBoard) which calls the API
 * to broadcast the text to all clients via realtime.
 */
async function readAloud(playerId: string) {
  if (!import.meta.client) return;
  const sub = props.submissions[playerId];
  if (!sub || !props.blackCard) return;

  // Check which card IDs are missing from the cardTexts map
  const missingIds = sub.filter((cardId) => !props.cardTexts?.[cardId]?.text);

  // Resolve missing texts on-demand (submitted cards aren't always in cardTexts)
  const resolvedTexts: Record<string, { text: string; pack: string }> = {};
  if (missingIds.length > 0) {
    try {
      const resolved = await $fetch<{ id: string; text: string; pack: string }[]>(
        "/api/cards/resolve",
        { method: "POST", body: { ids: missingIds } },
      );
      for (const card of resolved) {
        resolvedTexts[card.id] = { text: card.text, pack: card.pack };
      }
    } catch (err) {
      console.error("[ReadAloud] Failed to resolve card texts:", err);
    }
  }

  // Merge cardTexts prop + freshly resolved texts
  const whiteTexts = sub.map(
    (cardId) =>
      props.cardTexts?.[cardId]?.text ?? resolvedTexts[cardId]?.text ?? "",
  );

  const merged = mergeCardText(props.blackCard.text, whiteTexts);
  if (!merged) return;

  emit("read-aloud", merged);
}

// ── Handlers ────────────────────────────────────────────────────
function handleCardSubmit(cardIds: string[]) {
  // Start the ghost animation IMMEDIATELY so the card visually leaves the
  // hand the instant the player clicks — before the server round-trip.
  flyOptimisticSubmission(cardIds);
  emit("select-cards", cardIds);
}

function convertToPlayer(playerId: string) {
  emit("convert-to-player", playerId);
}

function handleRevealCard(playerId: string) {
  if (!props.isJudge || props.winnerSelected) return;
  if (isRevealed(playerId)) return;
  emit("reveal-card", playerId);
}

function handleSelectWinner(playerId: string) {
  if (!props.isJudge || props.winnerSelected) return;
  if (!isRevealed(playerId)) return;
  emit("select-winner", playerId);
}
</script>

<template>
  <div
    ref="tableRef"
    class="game-table"
  >
    <!-- Hidden template card for cloning optimistic fly-in ghosts.
         Always rendered off-screen so we can clone a pixel-perfect
         face-down WhiteCard that matches the badge fly-in ghosts. -->
    <div ref="ghostTemplateRef" class="ghost-template" aria-hidden="true">
      <WhiteCard
        :flipped="true"
        :disable-hover="true"
        :flat="true"
        :scale="75"
        back-logo-url="/img/ufp.svg"
      />
    </div>

    <!-- Table Center -->
    <div
      class="table-center"
      :class="{
        'table-center--pile':
          isSubmitting || (isJudging && !hasTransitionedToRow),
        'table-center--judging': isJudging && hasTransitionedToRow,
        'table-center--grid-scrollable':
          isJudging && hasTransitionedToRow && judgingCardScale === 0.6,
      }"
    >
      <!-- Judging info bar (compact, above cards) -->
      <div v-if="isJudging && !winnerSelected" class="judging-info">
        <template v-if="isJudge">
          <Icon name="mdi:gavel" class="judging-info-icon" />
          <span>{{
            allRevealed ? t("game.select_winner") : t("game.click_to_reveal")
          }}</span>
        </template>
        <template v-else>
          <span class="judging-info--waiting">
            {{ t("game.phase_judging") }}
            <template v-if="!allRevealed">
              · {{ t("game.waiting") }}...</template
            >
          </span>
        </template>
      </div>

      <!-- ═══ UNIFIED CARD AREA ═══ -->
      <!-- Pile mode: during submission phase -->
      <div
        v-if="isSubmitting || (isJudging && !hasTransitionedToRow)"
        ref="cardContainerRef"
        class="unified-card-container unified-card-container--pile"
      >
        <!-- Empty pile placeholder (submission phase, no cards yet) -->
        <div v-if="isSubmitting && submissionCount === 0" class="pile-empty">
          <Icon
            name="solar:layers-minimalistic-bold-duotone"
            class="text-slate-600 text-3xl"
          />
        </div>

        <!-- Pile cards (submission phase) -->
        <div
          v-for="sub in displaySubmissions"
          :key="sub.playerId"
          :data-player-id="sub.playerId"
          :data-pile-pid="sub.playerId"
          class="unified-card unified-card--pile"
          :style="getPileCardStyle(sub.playerId)"
        >
          <div class="submission-group submission-group--pile-mode">
            <div class="submission-cards">
              <WhiteCard
                v-for="cardId in sub.cards"
                :key="cardId"
                :cardId="cardId"
                :text="props.cardTexts?.[cardId]?.text"
                :card-pack="props.cardTexts?.[cardId]?.pack"
                :flipped="true"
                :is-winner="false"
                :disable-hover="true"
                :flat="true"
                :scale="75"
                back-logo-url="/img/ufp.svg"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Grid mode: during judging phase -->
      <div
        v-if="isJudging && hasTransitionedToRow"
        ref="cardContainerRef"
        class="judging-grid"
        :class="[
          densityClass,
          { 'judging-grid--scrollable': judgingCardScale === 0.6 },
        ]"
        :style="{ '--judging-card-scale': judgingCardScale }"
      >
        <div
          v-for="(sub, idx) in displaySubmissions"
          :key="sub.playerId"
          :ref="
            (el) => {
              if (el) gridCellRefs[sub.playerId] = el as HTMLElement;
            }
          "
          class="grid-cell"
          :class="{
            'grid-cell--winner':
              !winnerAnimating && effectiveRoundWinner === sub.playerId,
            'grid-cell--clickable':
              isJudge && !winnerSelected && !isRevealed(sub.playerId),
            'grid-cell--selectable':
              isJudge &&
              !winnerSelected &&
              isRevealed(sub.playerId) &&
              allRevealed,
            'grid-cell--hidden':
              !winnerAnimating &&
              effectiveRoundWinner &&
              effectiveRoundWinner !== sub.playerId,
          }"
        >
          <!-- Cell number label -->
          <span v-if="!effectiveRoundWinner" class="grid-cell-number">{{
            idx + 1
          }}</span>

          <!-- Card inside cell -->
          <div
            :data-player-id="sub.playerId"
            class="unified-card unified-card--grid"
            v-show="
              winnerAnimating ||
              !effectiveRoundWinner ||
              effectiveRoundWinner === sub.playerId
            "
          >
            <div v-if="justRevealed === sub.playerId" class="reveal-flash" />
            <div
              class="submission-group"
              :class="{
                'submission-group--revealed': isRevealed(sub.playerId),
                'submission-group--winner':
                  !winnerAnimating && effectiveRoundWinner === sub.playerId,
                'submission-group--clickable':
                  isJudge && !winnerSelected && !isRevealed(sub.playerId),
                'submission-group--selectable':
                  isJudge &&
                  !winnerSelected &&
                  isRevealed(sub.playerId) &&
                  allRevealed,
              }"
              @click="
                isJudge && !isRevealed(sub.playerId) && !winnerSelected
                  ? handleRevealCard(sub.playerId)
                  : isJudge &&
                      isRevealed(sub.playerId) &&
                      !winnerSelected &&
                      allRevealed
                    ? handleSelectWinner(sub.playerId)
                    : undefined
              "
            >
              <div class="submission-cards">
                <WhiteCard
                  v-for="cardId in sub.cards"
                  :key="cardId"
                  :cardId="cardId"
                  :text="props.cardTexts?.[cardId]?.text"
                  :card-pack="props.cardTexts?.[cardId]?.pack"
                  :flipped="!isRevealed(sub.playerId)"
                  :is-winner="effectiveRoundWinner === sub.playerId"
                  :disable-hover="!isRevealed(sub.playerId)"
                  :scale="Math.round(75 * judgingCardScale)"
                  back-logo-url="/img/ufp.svg"
                />
              </div>

              <!-- Judging phase UI placeholder -->
              <template v-if="showJudgingUI"> </template>
            </div>
          </div>

          <!-- Read-aloud button — positioned on the grid-cell (outside the card's 3D transform chain) -->
          <button
            v-if="
              showJudgingUI &&
              isJudge &&
              isRevealed(sub.playerId) &&
              !effectiveRoundWinner
            "
            class="read-aloud-btn"
            :class="{ 'read-aloud-btn--speaking': readingAloud }"
            :disabled="readingAloud"
            :title="t('game.read_aloud')"
            @click.stop="readAloud(sub.playerId)"
          >
            <Icon
              :name="
                readingAloud
                  ? 'svg-spinners:pulse-rings-multiple'
                  : 'solar:user-speak-bold-duotone'
              "
            />
          </button>
        </div>

        <!-- No submissions yet -->
        <p v-if="displaySubmissions.length === 0" class="empty-message">
          {{ t("game.waiting_for_submissions") }}
        </p>
      </div>
    </div>
    <!-- Spectator view -->
    <div v-if="blackCard && isSpectator" class="spectator-banner">
      <p>{{ t("game.you_are_spectating") }}</p>
      <UButton
        v-if="isHost"
        color="primary"
        icon="i-mdi-account-plus"
        size="sm"
        @click="convertToPlayer(myId)"
      >
        {{ t("game.convert_to_participant") }}
      </UButton>
    </div>

    <!-- HUD: score widget, status indicators, play mode toggle -->
    <GameTableHUD
      :players="players"
      :my-id="myId"
      :submissions="submissions"
      :is-judge="isJudge"
      :is-submitting="isSubmitting"
      :is-participant="isParticipant"
      :scores="scores"
      :play-mode="playMode"
      @cycle-mode="cycleMode"
    />

    <!-- UserHand at bottom (submission phase, not judge, not yet submitted) -->
    <Transition name="hand-exit">
      <div
        v-if="
          blackCard &&
          isParticipant &&
          !submissions[myId] &&
          isSubmitting &&
          !isJudge
        "
        class="fixed bottom-0 left-0 w-full flex justify-center items-end z-50"
      >
        <UserHand
          :cards="myHand"
          :cardsToSelect="blackCard?.pick || 1"
          :disabled="isJudge || false"
          :card-texts="props.cardTexts"
          :is-submitting="isSubmitting"
          @select-cards="handleCardSubmit"
        />
      </div>
    </Transition>

    <!-- Judge banner at bottom (submission phase, user is the judge) -->
    <Transition name="hand-exit">
      <div
        v-if="blackCard && isParticipant && isSubmitting && isJudge"
        class="judge-hand-banner"
      >
        <Icon name="mdi:gavel" class="judge-hand-icon" />
        <span class="judge-hand-title">{{ t("game.you_are_judge") }}</span>
        <span class="judge-hand-subtitle">{{
          t("game.waiting_for_submissions")
        }}</span>
      </div>
    </Transition>

    <!-- Winner Celebration Overlay -->
    <WinnerCelebration
      :winner-selected="winnerSelected"
      :effective-round-winner="effectiveRoundWinner"
      :confirmed-round-winner="confirmedRoundWinner"
      :winning-cards="winningCards"
      :black-card="blackCard"
      :players="players"
      :my-id="myId"
      :card-texts="cardTexts"
    />

    <!-- Prompt Skipped Overlay -->
    <PromptSkippedOverlay :trigger="skipAnnounceSerial" />

    <!-- Score Fly Badge -->
    <ScoreFlyBadge
      v-if="scoreFly"
      :from="scoreFly.from"
      :to="scoreFly.to"
      @done="scoreFly = null"
    />
  </div>
</template>

<style scoped>
.winner-spotlight {
  box-shadow:
    0 0 25px rgba(234, 179, 8, 0.4),
    0 0 60px rgba(234, 179, 8, 0.15);
  border: 1px solid rgba(234, 179, 8, 0.3);
  border-radius: 12px;
}

.game-table {
  position: relative;
  width: 100%;
  min-height: 50vh;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Off-screen template card for cloning optimistic fly-in ghosts */
.ghost-template {
  position: absolute;
  left: -9999px;
  top: -9999px;
  pointer-events: none;
}

/* ── Table Center ───────────────────────────────────────────── */
.table-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  width: 100%;
  max-width: 75%;
  margin: 0 auto;
  border: 1px solid rgba(139, 92, 246, 0.06);
  border-radius: 1.5rem;
  background: rgba(139, 92, 246, 0.015);
  box-shadow: inset 0 0 40px rgba(139, 92, 246, 0.02);
  /* Bound the card area so a dense judging grid scrolls internally
     instead of growing the page and pushing the header/hand off screen. */
  max-height: calc(100vh - 17rem);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 92, 246, 0.35) transparent;
}

.table-center::-webkit-scrollbar {
  width: 8px;
}

.table-center::-webkit-scrollbar-track {
  background: transparent;
}

.table-center::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.3);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.table-center::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 92, 246, 0.5);
  background-clip: content-box;
}

/* The pile is only a positioning layer; it should not read as a panel. */
.table-center--pile {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  max-height: none;
  overflow: visible;
  scrollbar-width: auto;
}

/* Once the grid reaches its scale floor, it owns the bounded scrollport. */
.table-center--grid-scrollable {
  max-height: none;
  overflow: hidden;
}

/* Judging cards should sit directly on the game table, without a purple panel. */
.table-center--judging {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}

/* ── Judging Info Bar ────────────────────────────────────────── */
.judging-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.35rem 1rem;

  font-size: 1.15rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(245, 158, 11, 0.85);
}

.judging-info-icon {
  font-size: 1.25rem;
  color: rgba(245, 158, 11, 0.9);
}

.judging-info--waiting {
  color: rgba(148, 163, 184, 0.7);
  animation: pulse-text 2s ease-in-out infinite;
}

@keyframes pulse-text {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

/* ── Unified Card Container ──────────────────────────────────── */
.unified-card-container {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
}

/* Pile mode: stack cards on top of each other */
.unified-card-container--pile {
  width: 320px;
  height: 340px;
  margin: 0 auto;
  transition: box-shadow 0.8s ease;
}

/* ── Judging Row (blackjack-style centred) ───────────────────── */
.judging-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: stretch;
  gap: 1rem;
  width: 100%;
  padding: 0.25rem;
}

.judging-grid--scrollable {
  max-height: calc(100dvh - 17rem);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.grid-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(139, 92, 246, 0.1);
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.2);
  padding: 0.4rem;
  box-shadow: 0 0 12px rgba(139, 92, 246, 0.03);
  transition:
    border-color 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.grid-cell:hover:not(.grid-cell--hidden) {
  border-color: rgba(139, 92, 246, 0.2);
  background: rgba(15, 23, 42, 0.3);
  box-shadow: 0 0 16px rgba(139, 92, 246, 0.06);
}

.grid-cell--clickable {
  cursor: pointer;
}

.grid-cell--clickable:hover {
  border-color: rgba(245, 158, 11, 0.5) !important;
  background: rgba(245, 158, 11, 0.06) !important;
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.08);
}

.grid-cell--selectable {
  cursor: pointer;
}

.grid-cell--selectable:hover {
  border-color: rgba(34, 197, 94, 0.5) !important;
  background: rgba(34, 197, 94, 0.06) !important;
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.12);
}

.grid-cell--winner {
  border-color: rgba(34, 197, 94, 0.6) !important;
  background: rgba(34, 197, 94, 0.08) !important;
  box-shadow: 0 0 24px rgba(34, 197, 94, 0.15);
}

.grid-cell--hidden {
  opacity: 0;
  transform: scale(0.9);
  pointer-events: none;
}

.grid-cell-number {
  position: absolute;
  top: 0.3rem;
  left: 0.45rem;

  font-size: 0.75rem;
  color: rgba(100, 116, 139, 0.3);
  letter-spacing: 0.04em;
  user-select: none;
  pointer-events: none;
}

/* Strip submission-group chrome inside judging cells — cell provides the border */
.grid-cell .submission-group {
  padding: 0;
  background: transparent;
  border-color: transparent;
  min-width: auto;
  gap: 0.5rem;
}

/* Pile mode: absolute positioned, stacked — Vue :style controls transform + opacity. */
.unified-card--pile {
  position: absolute;
  inset: 0;
  margin: auto;
  width: fit-content;
  height: fit-content;
}

/* Grid mode: normal flow inside cell */
.unified-card--grid {
  position: relative;
}

.pile-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 8rem;
  aspect-ratio: 3 / 4;
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 12px;
  background: rgba(139, 92, 246, 0.03);
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.05);
}

.pile-counter {
  font-size: 0.9rem;
  color: rgba(148, 163, 184, 0.9);
  text-align: left;
  letter-spacing: 0.05em;
  margin: 0;
  line-height: 1.2;
}

.pile-counter-label {
  display: inline;
  font-size: 0.75rem;
  color: rgba(100, 116, 139, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-left: 0.25rem;
}

.submitted-message {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.75rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.25);
  border-radius: 9999px;

  font-size: 0.8rem;
  color: rgba(34, 197, 94, 0.9);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* ── Submission Group ────────────────────────────────────────── */
.submission-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 1rem;
  background: rgba(51, 65, 85, 0.25);
  border: 2px solid transparent;
  transition: all 0.3s ease;
  min-width: 200px;
}

/* Pile mode: strip chrome so cards look like a clean stacked pile */
.submission-group--pile-mode {
  padding: 0;
  background: transparent;
  border-color: transparent;
  gap: 0;
  min-width: auto;
}

.submission-group--self {
  border-color: rgba(100, 116, 139, 0.3);
  background: rgba(51, 65, 85, 0.4);
}

.submission-group--revealed {
  background: rgba(51, 65, 85, 0.35);
  border-color: rgba(100, 116, 139, 0.15);
}

.submission-group--winner {
  border-color: rgba(34, 197, 94, 0.6) !important;
  background: rgba(34, 197, 94, 0.08);
  box-shadow: 0 0 24px rgba(34, 197, 94, 0.15);
}

.submission-group--clickable {
  cursor: pointer;
}

.submission-group--clickable:hover {
  border-color: rgba(245, 158, 11, 0.4);
  background: rgba(245, 158, 11, 0.06);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.submission-group--selectable {
  cursor: pointer;
}

.submission-group--selectable:hover {
  border-color: rgba(34, 197, 94, 0.5);
  background: rgba(34, 197, 94, 0.06);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(34, 197, 94, 0.2);
}

.submission-label {
  text-align: center;
}

.label-you {
  font-size: 1.1rem;
  color: rgba(34, 197, 94, 0.8);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.submission-cards {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  max-width: 100%;
  overflow: visible;
  padding-bottom: 0.25rem;
}

.submission-cards > * {
  transition:
    margin 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275),
    transform 0.5s ease;
}

/* Grid mode face down: stack overlapping right */
.unified-card--grid
  .submission-group:not(.submission-group--revealed)
  .submission-cards
  > *:not(:last-child) {
  margin-right: -6.5rem;
}
.unified-card--grid
  .submission-group:not(.submission-group--revealed)
  .submission-cards
  > *:nth-child(2) {
  transform: rotate(3deg) translateY(2px);
}
.unified-card--grid
  .submission-group:not(.submission-group--revealed)
  .submission-cards
  > *:nth-child(3) {
  transform: rotate(6deg) translateY(4px);
}

/* Grid mode revealed: unstack */
.unified-card--grid
  .submission-group--revealed
  .submission-cards
  > *:not(:last-child) {
  margin-right: 0.5rem;
}

/* Pile mode: fan combo cards so you can clearly see multiple cards */
.submission-group--pile-mode .submission-cards > *:not(:last-child) {
  margin-right: -4rem;
}
.submission-group--pile-mode .submission-cards > *:nth-child(2) {
  transform: rotate(8deg) translateY(4px);
}
.submission-group--pile-mode .submission-cards > *:nth-child(3) {
  transform: rotate(-6deg) translateY(-3px);
}

@media (min-width: 768px) {
  .unified-card--grid
    .submission-group:not(.submission-group--revealed)
    .submission-cards
    > *:not(:last-child) {
    margin-right: -9.5rem;
  }
  .submission-group--pile-mode .submission-cards > *:not(:last-child) {
    margin-right: -7rem;
  }

  .judging-grid {
    gap: 1.25rem;
    padding: 0.5rem;
  }

  .grid-cell {
    padding: 0.55rem;
  }
}

/* ── Density-aware sizing for multi-pick judging grids ──────────
   Keep cards near full size and rely on revealed-card overlap to
   fit everything horizontally. The judging phase has full viewport
   width (no hand at bottom), so we use it. */

/* Medium density (5-6 total cards) — minimal adjustments */
.judging-grid--medium {
  gap: 0.85rem;
}

/* Dense (7-8 total cards) — slight card reduction + overlap */
.judging-grid--dense {
  gap: 0.75rem;
}
.judging-grid--dense .grid-cell {
  padding: 0.5rem;
}

/* Very dense (9+ total cards — e.g. 5 players × Draw 2) */
.judging-grid--very-dense {
  gap: 0.65rem;
}
.judging-grid--very-dense .grid-cell {
  padding: 0.4rem;
}

/* Dense grids: overlap revealed cards to keep pairs compact but readable.
   The second card peeks out enough to read its text. */
.judging-grid--dense
  .unified-card--grid
  .submission-group--revealed
  .submission-cards
  > *:not(:last-child),
.judging-grid--very-dense
  .unified-card--grid
  .submission-group--revealed
  .submission-cards
  > *:not(:last-child) {
  margin-right: -3rem;
}

/* Face-down overlap: match proportionally to card width */
.judging-grid--dense
  .unified-card--grid
  .submission-group:not(.submission-group--revealed)
  .submission-cards
  > *:not(:last-child) {
  margin-right: -5rem;
}
.judging-grid--very-dense
  .unified-card--grid
  .submission-group:not(.submission-group--revealed)
  .submission-cards
  > *:not(:last-child) {
  margin-right: -4.5rem;
}

@media (min-width: 768px) {
  /* Desktop: stronger revealed overlap — single row of 5 groups fits */
  .judging-grid--dense
    .unified-card--grid
    .submission-group--revealed
    .submission-cards
    > *:not(:last-child),
  .judging-grid--very-dense
    .unified-card--grid
    .submission-group--revealed
    .submission-cards
    > *:not(:last-child) {
    margin-right: -5rem;
  }

  .judging-grid--dense
    .unified-card--grid
    .submission-group:not(.submission-group--revealed)
    .submission-cards
    > *:not(:last-child) {
    margin-right: -8rem;
  }

  .judging-grid--very-dense
    .unified-card--grid
    .submission-group:not(.submission-group--revealed)
    .submission-cards
    > *:not(:last-child) {
    margin-right: -7rem;
  }
}

/* ── Reveal Hint ─────────────────────────────────────────────── */
.reveal-hint {
  font-size: 0.9rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(245, 158, 11, 0.8);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  animation: pulse-text 2s ease-in-out infinite;
}

.reveal-hint--waiting {
  color: rgba(100, 116, 139, 0.6);
}

/* ── Winner Button ───────────────────────────────────────────── */
.winner-btn {
  width: 100%;
  border-radius: 0.75rem;
  cursor: pointer;
}

.winner-btn-text {
  font-size: 1.1rem;
  letter-spacing: 0.04em;
  color: white;
  text-align: center;
  width: 100%;
}

.winner-badge {
  font-size: 1.1rem;
  color: rgba(34, 197, 94, 0.9);
  letter-spacing: 0.04em;
  text-align: center;
  animation: winner-glow 1.5s ease-in-out infinite;
}

@keyframes winner-glow {
  0%,
  100% {
    text-shadow: 0 0 8px rgba(34, 197, 94, 0.3);
  }
  50% {
    text-shadow: 0 0 16px rgba(34, 197, 94, 0.6);
  }
}

/* ── Empty State ─────────────────────────────────────────────── */
.empty-message {
  font-style: italic;
  color: rgba(100, 116, 139, 0.6);
  text-align: center;
  padding: 2rem;
}

/* ── Spectator Banner ───────────────────────────────────────── */
.spectator-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  background: rgba(30, 41, 59, 0.6);
  border-radius: 1rem;
  text-align: center;
}

/* ── UserHand Fade Out ───────────────────────────────────────── */
.hand-exit-leave-active {
  transition:
    opacity 0.5s ease,
    transform 0.5s ease;
}

.hand-exit-leave-to {
  opacity: 0;
  transform: translateY(100px);
}

/* ── Judge Banner (bottom, replaces hand) ────────────────────── */
.judge-hand-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  z-index: 50;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;

  padding: 1.25rem 1rem 1.75rem;
  background: linear-gradient(
    to top,
    rgba(15, 23, 42, 0.92) 0%,
    rgba(15, 23, 42, 0.6) 70%,
    transparent 100%
  );
  /* A full-width fixed overlay across the bottom of the table: it must not
     swallow clicks meant for the cards underneath. Anything interactive added
     here has to set pointer-events: auto on itself. */
  pointer-events: none;
}

.judge-hand-icon {
  font-size: 2rem;
  color: rgba(245, 158, 11, 0.85);
  filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.3));
}

.judge-hand-title {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(245, 158, 11, 0.9);
}

.judge-hand-subtitle {
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  color: rgba(148, 163, 184, 0.7);
  animation: pulse-text 2s ease-in-out infinite;
}

/* ── Read-Aloud Button ──────────────────────────────────────── */
.read-aloud-btn {
  position: absolute;
  bottom: 0.35rem;
  right: 0.35rem;
  z-index: 10;

  display: flex;
  align-items: center;
  justify-content: center;

  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: none;
  cursor: pointer;

  background: rgba(245, 158, 11, 0.15);
  color: rgba(245, 158, 11, 0.85);
  font-size: 1.15rem;

  backdrop-filter: blur(4px);
  transition:
    background 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.read-aloud-btn:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.3);
  color: rgba(245, 158, 11, 1);
  transform: scale(1.12);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.25);
}

.read-aloud-btn:disabled {
  cursor: default;
  opacity: 0.6;
}

.read-aloud-btn--speaking {
  animation: speak-pulse 1.2s ease-in-out infinite;
}

@keyframes speak-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.2);
  }
  50% {
    box-shadow: 0 0 12px 4px rgba(245, 158, 11, 0.35);
  }
}

.reveal-flash {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse,
    rgba(255, 255, 255, 0.5) 0%,
    transparent 70%
  );
  border-radius: inherit;
  pointer-events: none;
  animation: flash-pulse 0.5s ease-out forwards;
  z-index: 5;
}

@keyframes flash-pulse {
  0% {
    opacity: 1;
    transform: scale(0.9);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
  100% {
    opacity: 0;
    transform: scale(1.1);
  }
}
</style>
