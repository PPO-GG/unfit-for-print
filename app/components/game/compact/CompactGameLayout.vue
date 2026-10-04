<script setup lang="ts">
import { useElementSize } from "@vueuse/core";
import type { Player } from "~/types/player";
import type { CardTexts } from "~/types/gamecards";
import type { GameState } from "~/types/game";
import type { CompactAction } from "~/utils/compactActionState";
import { compactActionState } from "~/utils/compactActionState";
import { cardBaseWidthPx, fitCardScale } from "~/utils/cardFit";
import { buildReadAloudText, resolveWhiteTextsViaApi } from "~/utils/readAloud";
import { useCompactLayout } from "~/composables/useCompactLayout";
import { useCompactMotion } from "~/composables/useCompactMotion";
import { useRoundUi } from "~/composables/useRoundUi";
import { SFX } from "~/config/sfx.config";

const props = defineProps<{
  phase: string;
  blackCard: GameState["blackCard"];
  myHand: string[];
  mySubmission: string[] | null;
  submissions: Record<string, string[]>;
  revealedCards: Record<string, boolean>;
  scores: Record<string, number>;
  goal: number;
  round: number;
  myId: string;
  isJudge: boolean;
  isHost: boolean;
  isSpectator: boolean;
  players: Player[];
  judgeId: string | null;
  cardTexts: CardTexts;
  effectiveRoundWinner: string | null;
  confirmedRoundWinner: string | null;
  winnerSelected: boolean;
  winningCards: string[];
  readingAloud: boolean;
  promptSerial?: number;
  blackSkipUsed?: boolean;
  /** Players the engine has skipped this round; nobody waits on them. */
  skippedPlayers?: string[];
  needsManualDraw: boolean;
  drawCount: number;
  chatUnread: number;
}>();

const emit = defineEmits<{
  "select-cards": [cardIds: string[]];
  "reveal-card": [playerId: string];
  "select-winner": [playerId: string];
  "read-aloud": [text: string];
  "next-round": [];
  "skip-prompt": [];
  draw: [];
  "open-menu": [];
}>();

const { t } = useI18n();
const { playSfx } = useSfx();
const { orientation, width: viewportWidth } = useCompactLayout();
const motion = useCompactMotion();

const pick = computed(() => props.blackCard?.pick ?? 1);
const ui = useRoundUi({
  phase: toRef(props, "phase"),
  promptSerial: toRef(props, "promptSerial"),
  pick,
  isHost: toRef(props, "isHost"),
  submissions: toRef(props, "submissions"),
  revealedCards: toRef(props, "revealedCards"),
});

// ── Who's who ──
function nameOf(userId: string | null): string {
  const p = props.players.find((pl) => pl.userId === userId);
  return p?.name?.trim() || t("compact.player_fallback");
}
const judgeName = computed(() => nameOf(props.judgeId));
const activePlayers = computed(() =>
  props.players.filter((p) => p.playerType !== "spectator"),
);
const skippedIds = computed(() => props.skippedPlayers ?? []);
// Players who still owe a card: not the judge, not skipped.
const expectedPlayers = computed(() =>
  activePlayers.value.filter(
    (p) => p.userId !== props.judgeId && !skippedIds.value.includes(p.userId),
  ),
);
const waitingOn = computed(() =>
  expectedPlayers.value
    .filter((p) => !props.submissions[p.userId])
    .map((p) => nameOf(p.userId)),
);
const lockedIds = computed(() =>
  props.phase === "submitting" ? Object.keys(props.submissions) : [],
);
const hasSubmitted = computed(() => props.mySubmission !== null);

// ── Which screen ──
type View =
  | "hand" | "submitted" | "judge-wait" | "spectating"
  | "shuffling" | "judging" | "round-end" | "empty";

// A winner gets ~2s of highlight on the judging carousel before GameBoard
// flips winnerSelected; a skipped round (no winner) goes straight to round end.
const roundEndReady = computed(
  () => props.winnerSelected || !props.effectiveRoundWinner,
);
const view = computed<View>(() => {
  switch (props.phase) {
    case "submitting":
      if (props.isSpectator) return "spectating";
      if (props.isJudge) return "judge-wait";
      return hasSubmitted.value ? "submitted" : "hand";
    case "submitting-complete":
      return "shuffling";
    case "judging":
      return "judging";
    case "roundEnd":
    case "complete":
      return roundEndReady.value ? "round-end" : "judging";
    default:
      return "empty";
  }
});
const skippedRound = computed(
  () => view.value === "round-end" && !props.effectiveRoundWinner,
);

// ── Prompt fills ──
const textsOf = (ids: string[]) => ids.map((id) => props.cardTexts[id]?.text ?? "");
const highlight = computed(
  () => props.effectiveRoundWinner ?? ui.pendingWinner.value,
);
const promptFills = computed(() => {
  switch (view.value) {
    case "hand":
      return textsOf(ui.selected.value);
    case "submitted":
      return textsOf(props.mySubmission ?? []);
    case "judging":
      return highlight.value ? textsOf(props.submissions[highlight.value] ?? []) : [];
    case "round-end":
      return skippedRound.value ? [] : textsOf(props.winningCards);
    default:
      return [];
  }
});

// ── Card sizes from measured slots ──
const promptSlot = ref<HTMLElement | null>(null);
const carouselSlot = ref<HTMLElement | null>(null);
const { width: promptW, height: promptH } = useElementSize(promptSlot);
const { height: carouselH } = useElementSize(carouselSlot);
const baseWidth = computed(() => {
  const rem = import.meta.client
    ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    : 16;
  return cardBaseWidthPx(rem, viewportWidth.value);
});
const promptScale = computed(() =>
  fitCardScale(promptW.value - 16, promptH.value - 8, baseWidth.value, { max: 170 }),
);
// The slot also holds the label row 44 + track padding 24 + dots 10 + ring lift ~6.
const cardScale = computed(() =>
  fitCardScale(Number.POSITIVE_INFINITY, carouselH.value - 84, baseWidth.value, { max: 150 }),
);
const judgeScale = computed(() =>
  pick.value > 1 ? Math.max(50, Math.round(cardScale.value * 0.8)) : cardScale.value,
);
const submittedScale = computed(() => Math.max(50, Math.round(cardScale.value * 0.7)));

// ── Bottom button ──
const actionState = computed(() =>
  compactActionState({
    phase: props.phase,
    isJudge: props.isJudge,
    isSpectator: props.isSpectator,
    hasSubmitted: hasSubmitted.value,
    selectedCount: ui.selected.value.length,
    pick: pick.value,
    allRevealed: ui.allRevealed.value,
    pendingWinner: ui.pendingWinner.value,
    // No early advance during the winner highlight.
    canAdvance: ui.canAdvance.value && roundEndReady.value,
    judgeName: judgeName.value,
    waitingOn: waitingOn.value,
  }),
);

const rootEl = ref<HTMLElement | null>(null);
const slideEls = (keys?: string[]) =>
  Array.from(rootEl.value?.querySelectorAll<HTMLElement>("[data-slide]") ?? []).filter(
    (el) => !keys || keys.includes(el.dataset.slide ?? ""),
  );

function onAct(action: CompactAction) {
  if (action === "submit") {
    const ids = [...ui.selected.value];
    const els = slideEls(ids);
    playSfx(SFX.cardThrow);
    // Ghost copies fly over the layout; the submit never waits on them.
    motion.flyToPrompt(els, promptSlot.value);
    emit("select-cards", ids);
    ui.clearSelection();
  } else if (action === "crown") {
    const winner = ui.pendingWinner.value;
    if (!winner) return;
    const [winnerEl] = slideEls([winner]);
    motion.crown(winnerEl ?? null, slideEls().filter((el) => el !== winnerEl));
    emit("select-winner", winner);
  } else if (action === "next-round") {
    emit("next-round");
  }
}

function onSelect(cardId: string) {
  ui.toggleCard(cardId);
  playSfx(SFX.cardSelect);
  nextTick(() => motion.popSelect(slideEls([cardId])));
}

function onReveal(playerId: string) {
  playSfx(SFX.cardFlip, { volume: 0.75, pitch: [0.95, 1.05] });
  emit("reveal-card", playerId);
}

async function onReadAloud(playerId: string) {
  const sub = props.submissions[playerId];
  if (!sub || !props.blackCard) return;
  const text = await buildReadAloudText(
    props.blackCard.text,
    sub,
    props.cardTexts,
    resolveWhiteTextsViaApi,
  );
  if (text) emit("read-aloud", text);
}

// ── Top bar pill ──
const pill = computed<{ label: string; tone: "cyan" | "yellow" | "lime" | "muted" }>(() => {
  if (view.value === "round-end" && skippedRound.value) {
    return { label: t("game.prompt_skipped"), tone: "muted" };
  }
  if (view.value === "round-end") {
    return { label: t("compact.round_won", { round: props.round }), tone: "lime" };
  }
  if (props.isJudge) return { label: t("compact.judging_you"), tone: "yellow" };
  if (props.phase === "judging") {
    return { label: t("compact.judging_other", { name: judgeName.value }), tone: "muted" };
  }
  return { label: t("compact.round_label", { round: props.round }), tone: "cyan" };
});

// ── Skip announcement (same rule as the old mobile layout) ──
const skipAnnounceSerial = computed(() =>
  props.blackSkipUsed ? props.promptSerial : undefined,
);

// ── Motion hooks ──
watch(
  () => [view.value, props.promptSerial] as const,
  ([v, serial], [prev, prevSerial]) => {
    // Deal in on entering the hand, and again when a skip swaps the prompt
    // (the view stays "hand" but the serial moves).
    if (v === "hand" && (prev !== "hand" || serial !== prevSerial)) {
      nextTick(() => motion.dealIn(slideEls()));
    }
    if (v === "round-end" && prev !== "round-end") {
      nextTick(() => {
        motion.dropIn(promptSlot.value?.firstElementChild ?? null);
        motion.fillBars(Array.from(rootEl.value?.querySelectorAll(".cre-bar i") ?? []));
        motion.popSelect(Array.from(rootEl.value?.querySelectorAll(".cre-plus") ?? [])); // "+1" pops in
      });
    }
  },
);
watch(lockedIds, (now, before) => {
  const fresh = now.filter((id) => !before?.includes(id));
  const els = fresh
    .map((id) => rootEl.value?.querySelector(`[data-player="${id}"]`))
    .filter((el): el is Element => !!el);
  motion.bounce(els);
});
watch(
  () => props.confirmedRoundWinner,
  async (winner) => {
    if (!winner || winner !== props.myId || motion.reduced()) return;
    try {
      const { burstConfetti } = await import("~/utils/confetti");
      burstConfetti({ particleCount: 90, spread: 80, origin: { x: 0.5, y: 0.35 } });
    } catch {
      // confetti unavailable — the round-end screen still says you won
    }
  },
);
onMounted(() => {
  if (view.value === "hand") nextTick(() => motion.dealIn(slideEls()));
});
</script>

<template>
  <div
    ref="rootEl"
    class="cgl lobby-tokens"
    :class="[`cgl--${orientation}`, `cgl--${view}`]"
  >
    <CompactTopBar
      class="cgl-top"
      :players="players"
      :judge-id="judgeId"
      :locked-ids="lockedIds"
      :pill-label="pill.label"
      :pill-tone="pill.tone"
      :unread="chatUnread"
      @menu="emit('open-menu')"
      @chat="emit('open-menu')"
    />

    <div ref="promptSlot" class="cgl-prompt">
      <BlackCard
        v-if="blackCard"
        :card-id="blackCard.id"
        :text="blackCard.text"
        :num-pick="blackCard.pick"
        :card-pack="blackCard.pack"
        :pack-display-name="blackCard.packDisplayName"
        :pack-series="blackCard.packSeries"
        :fills="promptFills"
        :scale="promptScale"
        :disable-hover="true"
      />
    </div>

    <div ref="carouselSlot" class="cgl-main">
      <template v-if="view === 'hand'">
        <div class="cgl-row">
          <span class="cgl-label">{{ t("compact.your_hand", { count: myHand.length }) }}</span>
          <button v-if="needsManualDraw" type="button" class="cgl-draw" @click="emit('draw')">
            {{ t("compact.draw", { count: drawCount }) }}
          </button>
          <span v-else class="cgl-label">{{ t("compact.swipe") }} ⟷</span>
        </div>
        <CompactCardCarousel
          mode="select"
          :card-texts="cardTexts"
          :cards="myHand"
          :selected="ui.selected.value"
          :show-order="pick > 1"
          :scale="cardScale"
          @select="onSelect"
        />
      </template>

      <template v-else-if="view === 'submitted'">
        <div class="cgl-row"><span class="cgl-label">{{ t("compact.submitted") }}</span></div>
        <CompactCardCarousel
          mode="select"
          :card-texts="cardTexts"
          :cards="mySubmission ?? []"
          :interactive="false"
          :scale="submittedScale"
        />
      </template>

      <div v-else-if="view === 'judge-wait'" class="cgl-status">
        <p class="cgl-status-title">
          {{ t("compact.locked_in", { done: Object.keys(submissions).length, total: expectedPlayers.length }) }}
        </p>
        <UButton
          v-if="blackCard && phase === 'submitting'"
          class="cgl-skip"
          size="lg"
          color="warning"
          variant="soft"
          icon="i-mdi-debug-step-over"
          block
          :disabled="blackSkipUsed"
          @click="emit('skip-prompt')"
        >
          {{ blackSkipUsed ? t("game.skip_prompt_used") : t("game.skip_prompt") }}
        </UButton>
      </div>

      <div v-else-if="view === 'spectating'" class="cgl-status">
        <p class="cgl-status-title">{{ t("compact.spectating") }}</p>
      </div>

      <div v-else-if="view === 'shuffling'" class="cgl-status">
        <p class="cgl-status-title">{{ t("compact.all_in") }}</p>
      </div>

      <template v-else-if="view === 'judging'">
        <div class="cgl-row">
          <span class="cgl-label">{{ ui.revealedCount.value }} / {{ ui.submissionIds.value.length }}</span>
        </div>
        <CompactCardCarousel
          mode="judge"
          :card-texts="cardTexts"
          :submissions="submissions"
          :order="ui.submissionIds.value"
          :revealed="revealedCards"
          :interactive="isJudge && phase === 'judging'"
          :highlight="highlight"
          :mine="isJudge ? null : myId"
          :can-read-aloud="isJudge"
          :reading-aloud="readingAloud"
          :scale="judgeScale"
          @reveal="onReveal"
          @pick="ui.choosePendingWinner"
          @read-aloud="onReadAloud"
        />
      </template>

      <CompactRoundEnd
        v-else-if="view === 'round-end'"
        :winner-id="effectiveRoundWinner"
        :players="players"
        :scores="scores"
        :goal="goal"
        :round="round"
        :skipped="skippedRound"
      />
    </div>

    <CompactActionBar class="cgl-action" :state="actionState" @act="onAct" />

    <PromptSkippedOverlay :trigger="skipAnnounceSerial" />
  </div>
</template>

<style scoped>
.cgl {
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 0.95fr) minmax(0, 1fr) auto;
  grid-template-areas: "top" "prompt" "main" "action";
  padding-top: env(safe-area-inset-top);
  background: radial-gradient(120% 70% at 50% 0%, var(--lb-bg-2) 0%, var(--lb-bg-1) 55%, var(--lb-bg-0) 100%);
  color: var(--lb-ink);
  font-family: "Barlow Condensed", sans-serif;
  overflow: hidden;
  overscroll-behavior: none;
}
.cgl--landscape {
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  grid-template-areas: "top main" "prompt main" "prompt action";
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
.cgl-top { grid-area: top; }
.cgl-prompt {
  grid-area: prompt;
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 4px 8px;
}
.cgl-main {
  grid-area: main;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.cgl-action { grid-area: action; }
.cgl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  min-height: 44px;
}
.cgl-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lb-ink-dim);
}
.cgl-draw {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--lb-accent-shadow);
  color: var(--lb-accent);
  font-family: "Archivo Black", sans-serif;
  font-size: 0.8rem;
  text-transform: uppercase;
}
.cgl-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 16px 24px;
  text-align: center;
}
.cgl-status-title {
  margin: 0;
  font-family: "Archivo Black", sans-serif;
  font-size: 1.1rem;
  text-transform: uppercase;
  color: var(--lb-ink-dim);
}
.cgl-skip { min-height: 44px; max-width: 18rem; }
</style>
