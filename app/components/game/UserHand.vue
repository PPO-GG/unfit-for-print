<script lang="ts" setup>
import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  nextTick,
  toRef,
} from "vue";
import { useSfx } from "@/composables/useSfx";
import { useCardFlyCoords } from "@/composables/useCardFlyCoords";
import { useCardPlayPreferences } from "@/composables/useCardPlayPreferences";
import { useCardGesture } from "@/composables/useCardGesture";
import { SFX } from "~/config/sfx.config";
import { gsap } from "gsap";

const { t } = useI18n();

const props = defineProps<{
  cards: string[];
  disabled?: boolean;
  cardsToSelect?: number;
}>();

const emit = defineEmits<{
  (e: "select-cards", cardIds: string[]): void;
}>();

const selectedCards = ref<string[]>([]);
const hoveredIndex = ref<number | null>(null);
const handRef = ref<HTMLElement | null>(null);
const cardRefs = ref<HTMLElement[]>([]);
const { playSfx } = useSfx();
const { snapshotCards } = useCardFlyCoords();

// Auto-submit state
const autoSubmitTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const autoSubmitProgress = ref(0); // 0-1 for countdown ring
const AUTO_SUBMIT_DELAY = 1200; // ms
let progressRaf: number | null = null;
let progressStart = 0;

// ── Play mode preferences ──────────────────────────────────────────────────
const { playMode, instantSubmit, gestureEnabled, cycleMode } =
  useCardPlayPreferences();

const playHoverSfx = () => playSfx(SFX.cardHover);
const playSelectSfx = () => playSfx(SFX.cardSelect);

const cardsToSelect = computed(() => props.cardsToSelect || 1);
const allSelected = computed(
  () => selectedCards.value.length === cardsToSelect.value,
);

// ── Responsive fan parameters ──────────────────────────────────────────────
const windowWidth = ref(
  typeof window !== "undefined" ? window.innerWidth : 1024,
);
const isMobile = computed(() => windowWidth.value < 768);

// Fan geometry
const FAN = computed(() => {
  const n = props.cards.length;
  const w = windowWidth.value;
  const totalArc = Math.min(40, n * 5);
  const arcStep = n > 1 ? totalArc / (n - 1) : 0;
  const curveIntensity = w < 768 ? 2 : 4;
  const spread = w < 768 ? 28 : Math.min(65, w / 28);
  const hoverPush = w < 768 ? 15 : 35;
  const hoverLift = w < 768 ? 20 : 50;
  return { totalArc, arcStep, curveIntensity, spread, hoverPush, hoverLift };
});

// ── GSAP Animation ─────────────────────────────────────────────────────────
function getBaseTransform(i: number) {
  const n = props.cards.length;
  const center = (n - 1) / 2;
  const offset = i - center;
  const { arcStep, curveIntensity, spread } = FAN.value;

  const x = offset * spread;
  const rotation = offset * arcStep;
  const y = Math.abs(offset) * Math.abs(offset) * curveIntensity;

  return { x, y, rotation };
}

function animateCards() {
  if (!cardRefs.value.length || isMobile.value) return;

  const hovered = hoveredIndex.value;
  const { hoverPush, hoverLift } = FAN.value;

  cardRefs.value.forEach((el, i) => {
    if (!el) return;

    const base = getBaseTransform(i);
    let x = base.x;
    let y = base.y;
    let rotation = base.rotation;
    let scale = 1;
    let zIndex = i;

    const isSelected = selectedCards.value.includes(props.cards[i] ?? "");

    if (hovered !== null) {
      if (i === hovered) {
        y -= hoverLift;
        scale = 1.15;
        rotation *= 0.3;
        zIndex = 100;
      } else {
        const distance = i - hovered;
        const pushFactor = Math.max(0, 1 - Math.abs(distance) * 0.25);
        const direction = distance > 0 ? 1 : -1;
        x += direction * hoverPush * pushFactor;
      }
    }

    if (isSelected) {
      y -= 25;
      scale = Math.max(scale, 1.05);
      zIndex = Math.max(zIndex, 90);
    }

    gsap.to(el, {
      x,
      y,
      rotation,
      scale,
      zIndex,
      duration: 0.4,
      ease: "power3.out",
      overwrite: "auto",
    });
  });
}

watch(hoveredIndex, () => animateCards());
watch(selectedCards, () => animateCards(), { deep: true });

// Staggered entrance when cards change
watch(
  () => props.cards,
  () => {
    // Cancel any pending auto-submit from previous round
    cancelAutoSubmit();
    selectedCards.value = [];
    nextTick(() => {
      cardRefs.value.forEach((el) => {
        if (!el) return;
        gsap.set(el, { x: 0, y: 80, rotation: 0, scale: 0.8, opacity: 0 });
      });
      cardRefs.value.forEach((el, i) => {
        if (!el) return;
        const base = getBaseTransform(i);
        gsap.to(el, {
          x: base.x,
          y: base.y,
          rotation: base.rotation,
          scale: 1,
          opacity: 1,
          duration: 0.6,
          delay: i * 0.05,
          ease: "back.out(1.4)",
        });
      });
    });
  },
  { flush: "post" },
);

// ── Auto-Submit ────────────────────────────────────────────────────────────
function doSubmitNow() {
  const selectedEls = cardRefs.value.filter(
    (el, i) => el && selectedCards.value.includes(props.cards[i] ?? ""),
  );
  snapshotCards(selectedEls);
  emit("select-cards", [...selectedCards.value]);
  playSfx(SFX.cardThrow);
}

function startAutoSubmit() {
  cancelAutoSubmit();
  progressStart = performance.now();
  autoSubmitProgress.value = 0;

  // Animate the progress ring
  function tick() {
    const elapsed = performance.now() - progressStart;
    autoSubmitProgress.value = Math.min(1, elapsed / AUTO_SUBMIT_DELAY);
    if (autoSubmitProgress.value < 1) {
      progressRaf = requestAnimationFrame(tick);
    }
  }
  progressRaf = requestAnimationFrame(tick);

  autoSubmitTimer.value = setTimeout(() => {
    if (allSelected.value && !props.disabled) {
      doSubmitNow();
    }
    autoSubmitTimer.value = null;
    autoSubmitProgress.value = 0;
  }, AUTO_SUBMIT_DELAY);
}

function cancelAutoSubmit() {
  if (autoSubmitTimer.value) {
    clearTimeout(autoSubmitTimer.value);
    autoSubmitTimer.value = null;
  }
  if (progressRaf) {
    cancelAnimationFrame(progressRaf);
    progressRaf = null;
  }
  autoSubmitProgress.value = 0;
}

// Watch for all cards selected → branch by play mode
watch(allSelected, (val) => {
  if (val && !props.disabled) {
    if (instantSubmit.value) {
      // Instant mode: submit immediately, no timer
      doSubmitNow();
    } else if (gestureEnabled.value) {
      // Gesture mode: don't auto-submit, user must drag/flick
      // (no-op — cards stay selected, waiting for gesture)
    } else {
      // Default click mode: start the countdown timer
      startAutoSubmit();
    }
  } else {
    cancelAutoSubmit();
  }
});

// ── Card gesture composable ────────────────────────────────────────────────
const { isDragging, onPointerDown, onPointerMove, onPointerUp } =
  useCardGesture({
    cardRefs,
    selectedCards,
    cards: toRef(props, "cards"),
    getBaseTransform,
    onSubmit: (cardIds: string[]) => {
      const selectedEls = cardRefs.value.filter(
        (el, i) => el && cardIds.includes(props.cards[i] ?? ""),
      );
      snapshotCards(selectedEls);
      emit("select-cards", cardIds);
      playSfx(SFX.cardThrow);
    },
    enabled: gestureEnabled,
    disabled: toRef(props, "disabled"),
  });

// ── Interactions ────────────────────────────────────────────────────────────

function handleHandMouseMove(e: MouseEvent) {
  if (isMobile.value || !handRef.value) return;

  // Only hover a card when the cursor is directly over its bounding box
  let found: number | null = null;
  for (let i = 0; i < cardRefs.value.length; i++) {
    const el = cardRefs.value[i];
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    ) {
      found = i;
      // Don't break — later cards have higher z-index, so last match wins
    }
  }

  if (hoveredIndex.value !== found) {
    hoveredIndex.value = found;
    if (found !== null) playHoverSfx();
  }
}

const isHandActive = ref(false);

function handleMouseEnter() {
  if (!isMobile.value) {
    isHandActive.value = true;
  }
}

function handleMouseLeave() {
  if (!isMobile.value) {
    isHandActive.value = false;
    hoveredIndex.value = null;
  }
}

function handleHandClick() {
  if (props.disabled || isMobile.value) return;
  const index = hoveredIndex.value;
  if (index === null) return;
  const cardId = props.cards[index];
  if (!cardId) return;
  toggleCardSelection(cardId, index);
}

function onCardClick(e: MouseEvent, cardId: string, index: number) {
  if (isMobile.value) {
    e.stopPropagation();
    if (!props.disabled) toggleCardSelection(cardId, index);
  }
}

function toggleCardSelection(cardId: string, index: number) {
  const idx = selectedCards.value.indexOf(cardId);
  if (idx === -1) {
    if (selectedCards.value.length < cardsToSelect.value) {
      selectedCards.value.push(cardId);
      const el = cardRefs.value[index];
      if (el) {
        gsap.fromTo(
          el,
          { scale: 1.15 },
          {
            scale: 1.05,
            duration: 0.3,
            ease: "elastic.out(1.2, 0.4)",
            onComplete: () => animateCards(),
          },
        );
      }
    }
  } else {
    selectedCards.value.splice(idx, 1);
    // Deselecting cancels auto-submit (handled by watcher)
  }
  playSelectSfx();
}

// Selection order badge
function selectionOrder(cardId: string): number {
  return selectedCards.value.indexOf(cardId) + 1;
}

// SVG ring for auto-submit countdown
const ringCircumference = 2 * Math.PI * 18; // r=18 for a 44px ring
const ringDashoffset = computed(() => {
  return ringCircumference * (1 - autoSubmitProgress.value);
});

// ── Window resize ──────────────────────────────────────────────────────────
const handleResize = () => {
  windowWidth.value = window.innerWidth;
  animateCards();
};

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("resize", handleResize);
  }
  nextTick(() => {
    cardRefs.value.forEach((el, i) => {
      if (!el) return;
      const base = getBaseTransform(i);
      gsap.set(el, { x: 0, y: 80, rotation: 0, scale: 0.8, opacity: 0 });
      gsap.to(el, {
        x: base.x,
        y: base.y,
        rotation: base.rotation,
        scale: 1,
        opacity: 1,
        duration: 0.6,
        delay: i * 0.06,
        ease: "back.out(1.4)",
      });
    });
  });
});

onUnmounted(() => {
  cancelAutoSubmit();
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", handleResize);
  }
});
</script>

<template>
  <div
    class="user-hand"
    :class="{
      'user-hand--active': isHandActive || selectedCards.length > 0 || isMobile,
      'user-hand--gesture': gestureEnabled,
    }"
  >
    <!-- Auto-submit countdown indicator (shows when all cards picked, click mode only) -->
    <div
      v-if="allSelected && autoSubmitProgress > 0 && playMode === 'click'"
      class="auto-submit-indicator"
    >
      <svg class="countdown-ring" viewBox="0 0 44 44">
        <circle class="ring-bg" cx="22" cy="22" r="18" />
        <circle
          class="ring-progress"
          cx="22"
          cy="22"
          r="18"
          :stroke-dasharray="ringCircumference"
          :stroke-dashoffset="ringDashoffset"
        />
      </svg>
      <span class="auto-submit-label">{{ t("game.submit_cards") }}</span>
    </div>

    <!-- Gesture hint (shown when gesture mode is active and cards are selected) -->
    <div
      v-if="gestureEnabled && allSelected && !isDragging"
      class="gesture-hint"
    >
      <Icon name="solar:hand-shake-bold-duotone" class="text-sky-400" />
      <span>{{ t("game.drag_to_play") }}</span>
    </div>

    <!-- Selection counter for multi-pick -->
    <div
      v-if="cardsToSelect > 1 && selectedCards.length > 0 && !allSelected"
      class="pick-counter"
    >
      <span class="pick-counter-text">
        {{
          t("game.selected_cards", {
            count: selectedCards.length,
            total: cardsToSelect,
          })
        }}
      </span>
    </div>

    <!-- Card fan (desktop) / scroll (mobile) -->
    <div
      ref="handRef"
      class="hand-zone"
      :class="{ 'hand-zone--mobile': isMobile }"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @mousemove="handleHandMouseMove"
      @click="handleHandClick"
    >
      <div :class="isMobile ? 'hand-scroll' : 'hand-arc'">
        <div
          v-for="(cardId, index) in props.cards"
          :key="cardId"
          ref="cardRefs"
          class="hand-card"
          :class="{
            'hand-card--mobile': isMobile,
            'hand-card--fan': !isMobile,
            'hand-card--selected': selectedCards.includes(cardId),
            'hand-card--hovered': hoveredIndex === index && !isMobile,
            'hand-card--locked':
              allSelected &&
              selectedCards.includes(cardId) &&
              playMode === 'click',
            'hand-card--draggable':
              gestureEnabled && allSelected && selectedCards.includes(cardId),
          }"
          @click="onCardClick($event, cardId, index)"
          @pointerdown="
            gestureEnabled ? onPointerDown($event, cardId, index) : undefined
          "
          @pointermove="gestureEnabled ? onPointerMove($event) : undefined"
          @pointerup="gestureEnabled ? onPointerUp($event) : undefined"
        >
          <!-- Selection order badge (multi-pick) -->
          <div
            v-if="cardsToSelect > 1 && selectedCards.includes(cardId)"
            class="selection-badge"
          >
            {{ selectionOrder(cardId) }}
          </div>
          <WhiteCard :cardId="cardId" :disableHover="true" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-hand {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 0.5rem;
  transform: translateY(60%);
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  pointer-events: none;
}

@media (max-width: 768px) {
  .user-hand {
    transform: translateY(0);
  }
}

.user-hand--active {
  transform: translateY(0);
}

/* ── Auto-Submit Indicator ───────────────────────────────────── */
.auto-submit-indicator {
  position: absolute;
  top: -13rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 110;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem 0.5rem 0.5rem;
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.4);
  border-radius: 9999px;
  backdrop-filter: blur(12px);
  white-space: nowrap;
  animation: indicator-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  pointer-events: auto;
}

.auto-submit-label {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1rem;
  letter-spacing: 0.06em;
  color: rgba(34, 197, 94, 1);
  text-transform: uppercase;
}

@keyframes indicator-in {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(6px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.countdown-ring {
  width: 32px;
  height: 32px;
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: rgba(34, 197, 94, 0.15);
  stroke-width: 3;
}

.ring-progress {
  fill: none;
  stroke: rgba(34, 197, 94, 0.9);
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.05s linear;
}

/* ── Pick Counter ────────────────────────────────────────────── */
.pick-counter {
  position: absolute;
  top: -13rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 110;
  padding: 0.35rem 1rem;
  background: rgba(100, 116, 139, 0.2);
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-radius: 9999px;
  backdrop-filter: blur(8px);
  white-space: nowrap;
  pointer-events: auto;
}

.pick-counter-text {
  font-family: "Bebas Neue", sans-serif;
  font-size: 0.9rem;
  letter-spacing: 0.04em;
  color: rgba(148, 163, 184, 1);
  text-transform: uppercase;
}

/* ── Card Zone ────────────────────────────────────────────────── */
.hand-zone {
  position: relative;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  pointer-events: auto;
}

.hand-zone--mobile {
  overflow-x: auto;
  padding: 0.5rem 1rem;
  -webkit-overflow-scrolling: touch;
}

.hand-arc {
  position: relative;
  width: 100%;
  height: 200px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.hand-scroll {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.5rem;
  min-width: min-content;
  margin: 0 auto;
  padding-bottom: 0.25rem;
}

/* ── Individual Card ──────────────────────────────────────────── */
.hand-card {
  cursor: pointer;
  transform-origin: center bottom;
  position: relative;
}

.hand-card--mobile {
  position: relative;
  flex-shrink: 0;
  width: 8rem;
}

.hand-card--fan {
  position: absolute;
  bottom: 0;
  width: 8rem;
  will-change: transform;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
  transition: filter 0.2s ease;
}

.hand-card--hovered {
  filter: drop-shadow(0 16px 32px rgba(0, 0, 0, 0.5)) brightness(1.05);
}

.hand-card--selected {
  filter: drop-shadow(0 0 16px rgba(34, 197, 94, 0.6))
    drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4));
}

.hand-card--selected::after {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: 15px;
  border: 3px solid rgba(34, 197, 94, 0.8);
  pointer-events: none;
  animation: selection-pulse 2s ease-in-out infinite;
}

/* When auto-submit is active, locked cards get a brighter glow */
.hand-card--locked {
  filter: drop-shadow(0 0 24px rgba(34, 197, 94, 0.8))
    drop-shadow(0 8px 20px rgba(0, 0, 0, 0.5));
}

.hand-card--locked::after {
  border-color: rgba(34, 197, 94, 1);
  animation: locked-glow 0.6s ease-in-out infinite;
}

@keyframes selection-pulse {
  0%,
  100% {
    border-color: rgba(34, 197, 94, 0.8);
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.3);
  }
  50% {
    border-color: rgba(34, 197, 94, 1);
    box-shadow: 0 0 16px rgba(34, 197, 94, 0.5);
  }
}

@keyframes locked-glow {
  0%,
  100% {
    box-shadow: 0 0 12px rgba(34, 197, 94, 0.5);
  }
  50% {
    box-shadow: 0 0 24px rgba(34, 197, 94, 0.8);
  }
}

/* ── Selection Badge ─────────────────────────────────────────── */
.selection-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 10;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(34, 197, 94, 1);
  color: white;
  font-family: "Bebas Neue", sans-serif;
  font-size: 0.85rem;
  font-weight: bold;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  animation: badge-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  pointer-events: none;
}

@keyframes badge-pop {
  from {
    opacity: 0;
    transform: scale(0);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* ── Gesture Hint ────────────────────────────────────────────── */
.gesture-hint {
  position: absolute;
  top: -13rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 110;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem 0.5rem 0.75rem;
  background: rgba(14, 165, 233, 0.12);
  border: 1px solid rgba(14, 165, 233, 0.35);
  border-radius: 9999px;
  backdrop-filter: blur(12px);
  white-space: nowrap;
  animation: indicator-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  font-family: "Bebas Neue", sans-serif;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  color: rgba(14, 165, 233, 0.9);
  text-transform: uppercase;
  pointer-events: auto;
}

/* ── Draggable card cursor ───────────────────────────────────── */
.hand-card--draggable {
  cursor: grab;
}

.hand-card--draggable:active {
  cursor: grabbing;
}

/* ── Gesture mode: prevent scroll conflicts on touch ─────────── */
.user-hand--gesture .hand-zone {
  touch-action: none;
}

@media (min-width: 768px) {
  .hand-card--fan {
    width: 11rem;
  }
  .hand-card--mobile {
    width: 11rem;
  }
}

@media (min-width: 1024px) {
  .hand-card--fan {
    width: 14rem;
  }
}
</style>
