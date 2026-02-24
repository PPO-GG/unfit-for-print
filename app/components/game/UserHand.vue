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
import { useWhiteDeckPosition } from "@/composables/useWhiteDeckPosition";
import { SFX } from "~/config/sfx.config";
import { gsap } from "gsap";
import type { CardTexts } from "~/types/gamecards";

// Module-level: survives component destroy/recreate (v-if toggle between rounds)
// Stored on window to also survive HMR module re-evaluation during development.
const previousHandIds: Set<string> =
  typeof window !== "undefined" && (window as any).__ufpPreviousHandIds
    ? (window as any).__ufpPreviousHandIds
    : (() => {
        const s = new Set<string>();
        if (typeof window !== "undefined")
          (window as any).__ufpPreviousHandIds = s;
        return s;
      })();

const { t } = useI18n();

const props = defineProps<{
  cards: string[];
  disabled?: boolean;
  cardsToSelect?: number;
  /** Resolved card texts from the server — eliminates per-card Appwrite fetches. */
  cardTexts?: CardTexts;
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
const { getDeckCenter, triggerDeal } = useWhiteDeckPosition();

// Guard: skip re-entrance animation when server confirms card removal after submit
const justSubmitted = ref(false);

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
  const isMob = w < 768;
  const totalArc = Math.min(isMob ? 50 : 40, n * (isMob ? 6 : 5));
  const arcStep = n > 1 ? totalArc / (n - 1) : 0;
  const curveIntensity = isMob ? 3 : 4;
  const spread = isMob ? 24 : Math.min(70, w / 26);
  // Increase push and lift dramatically for better hit-detection and feel
  const hoverPush = isMob ? 32 : 65;
  const hoverLift = isMob ? 40 : 65;
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
  if (!cardRefs.value.length) return;

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
        scale = 1.25;
        rotation *= 0.15; // Straighten up the card significantly
        zIndex = 100;
      } else {
        const distance = Math.abs(i - hovered);
        const direction = i > hovered ? 1 : -1;
        // Stronger push for immediate neighbors, tapers off smoothly
        const pushFactor = Math.max(0, 1 - (distance - 1) * 0.35);

        x += direction * hoverPush * pushFactor;
        // Neighbours also get pushed slightly sideways in their angle to make room
        rotation += direction * 4 * pushFactor;
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
  (newCards, oldCards) => {
    // Only re-animate if the actual cards changed, not just the array reference
    if (oldCards && newCards.join(",") === oldCards.join(",")) return;

    // Skip re-entrance if we just submitted (server removed cards from hand)
    if (justSubmitted.value) {
      justSubmitted.value = false;
      selectedCards.value = [];
      // Update previous hand for next mount cycle
      previousHandIds.clear();
      newCards.forEach((id) => previousHandIds.add(id));
      return;
    }

    // Cancel any pending auto-submit from previous round
    cancelAutoSubmit();
    selectedCards.value = [];

    // Detect which cards are genuinely new (drawn from deck)
    // Only compare if we have a previous hand; otherwise treat as normal entrance
    const hasPrevious = previousHandIds.size > 0;
    const newCardIds = hasPrevious
      ? newCards.filter((id) => !previousHandIds.has(id))
      : [];

    // Phase 2: Only animate new cards from the white deck
    const deckCenter = newCardIds.length > 0 ? getDeckCenter() : null;
    if (newCardIds.length > 0) {
      triggerDeal(newCardIds.length * 70 + 500);
    }

    nextTick(() => {
      // Calculate deck offset for new cards
      let fromX = 0;
      let fromY = 80;

      if (deckCenter) {
        const firstEl = cardRefs.value.find((el) => el);
        if (firstEl) {
          gsap.set(firstEl, { clearProps: "all" });
          const elRect = firstEl.getBoundingClientRect();
          const elCenterX = elRect.left + elRect.width / 2;
          const elCenterY = elRect.top + elRect.height / 2;
          fromX = deckCenter.x - elCenterX;
          fromY = deckCenter.y - elCenterY;
        }
      }

      cardRefs.value.forEach((el, i) => {
        if (!el) return;
        const cardId = newCards[i];
        const isNew = cardId && newCardIds.includes(cardId);

        if (isNew) {
          // New card: start from deck, animate to fan position
          gsap.set(el, {
            x: fromX,
            y: fromY,
            rotation: 0,
            scale: 0.4,
            opacity: 0,
          });
        } else {
          // Existing card: just set initial hidden state for re-fan
          gsap.set(el, { opacity: 0 });
        }
      });

      let newCardAnimIndex = 0;
      cardRefs.value.forEach((el, i) => {
        if (!el) return;
        const base = getBaseTransform(i);
        const cardId = newCards[i];
        const isNew = cardId && newCardIds.includes(cardId);

        if (isNew) {
          // Play a flip SFX staggered to match each card's animation
          const sfxDelay = newCardAnimIndex * 100;
          setTimeout(() => playSfx(SFX.cardFlip), sfxDelay);
        }

        gsap.to(el, {
          x: base.x,
          y: base.y,
          rotation: base.rotation,
          scale: 1,
          opacity: 1,
          duration: isNew ? 0.55 : 0.3,
          delay: isNew ? newCardAnimIndex++ * 0.1 : 0,
          ease: isNew ? "power3.out" : "power2.out",
        });
      });

      // Update previous hand
      previousHandIds.clear();
      newCards.forEach((id) => previousHandIds.add(id));
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

  // Phase 1: Animate selected cards out of the fan immediately
  selectedEls.forEach((el, i) => {
    gsap.to(el, {
      y: "-=130",
      scale: 0.3,
      opacity: 0,
      rotation: `+=${(Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 20)}`,
      duration: 0.4,
      delay: i * 0.06,
      ease: "power2.in",
    });
  });

  justSubmitted.value = true;
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
    onSubmit: (cardIds: string[], preSnapshotEls: HTMLElement[]) => {
      // Use the pre-snapshotted elements captured BEFORE the fling
      // animation — by this point the actual card DOM nodes are faded out.
      snapshotCards(preSnapshotEls);
      emit("select-cards", cardIds);
      playSfx(SFX.cardThrow);
    },
    enabled: gestureEnabled,
    disabled: toRef(props, "disabled"),
    allSelected,
  });

// ── Interactions ────────────────────────────────────────────────────────────

function handlePointerMove(e: MouseEvent | TouchEvent) {
  if (!handRef.value || isDragging.value) return;

  let clientX: number, clientY: number;
  if ("touches" in e) {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    if (!touch) return;
    clientX = touch.clientX;
    clientY = touch.clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  // 1. Verify we are physically touching the card fan pixels so we don't hover on empty space
  const target = document.elementFromPoint(clientX, clientY);
  const cardEl = target?.closest(".hand-card");

  if (!cardEl) {
    if (hoveredIndex.value !== null) {
      hoveredIndex.value = null;
    }
    return;
  }

  // 2. Mathematically map the pointer's X coordinate to the closest static baseline card.
  // This completely eliminates z-index stacking bias (which made left-to-right sweeping fail)
  // because the hover target transitions exactly at the midpoint between two cards' origins!
  const rect = handRef.value.getBoundingClientRect();
  const containerCenterX = rect.left + rect.width / 2;
  const cursorX = clientX - containerCenterX;

  const n = cardRefs.value.length;
  const center = (n - 1) / 2;
  const { spread } = FAN.value;

  let closestIndex: number | null = null;
  let minDistance = Infinity;

  for (let i = 0; i < n; i++) {
    const baseX = (i - center) * spread;
    const distance = Math.abs(cursorX - baseX);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }

  if (hoveredIndex.value !== closestIndex) {
    hoveredIndex.value = closestIndex;
    if (closestIndex !== null) playHoverSfx();
  }
}

function handleTouchStart(e: TouchEvent) {
  if (isDragging.value) return;
  isHandActive.value = true;
  handlePointerMove(e);
}

const isHandActive = ref(false);

function handleMouseEnter() {
  isHandActive.value = true;
}

function handleMouseLeave() {
  isHandActive.value = false;
  hoveredIndex.value = null;
}

function handleHandClick() {
  // Clear hover on empty space click for mobile
  if (isMobile.value && !props.disabled) {
    hoveredIndex.value = null;
    return;
  }
  if (props.disabled) return;
  const index = hoveredIndex.value;
  if (index === null) return;
  const cardId = props.cards[index];
  if (!cardId) return;
  toggleCardSelection(cardId, index);
}

function onCardClick(e: MouseEvent | Event, cardId: string, index: number) {
  e.stopPropagation();
  if (!props.disabled) toggleCardSelection(cardId, index);
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

  // Detect which cards are genuinely new (not in previous hand)
  const hasReturnedCards = previousHandIds.size > 0;
  const newCardIds = hasReturnedCards
    ? props.cards.filter((id) => !previousHandIds.has(id))
    : [];

  // Always update previousHandIds, even if cards aren't rendered yet.
  // This ensures the state persists across component destroy/recreate.
  if (props.cards.length > 0) {
    previousHandIds.clear();
    props.cards.forEach((id) => previousHandIds.add(id));
  }

  // Phase 2: Only animate genuinely new cards from the deck
  const deckCenter = newCardIds.length > 0 ? getDeckCenter() : null;
  if (newCardIds.length > 0) {
    triggerDeal(newCardIds.length * 70 + 500);
  }

  nextTick(() => {
    if (!cardRefs.value.length) return;

    // Calculate deck offset for new cards
    let fromX = 0;
    let fromY = 80;

    if (deckCenter) {
      const firstEl = cardRefs.value.find((el) => el);
      if (firstEl) {
        gsap.set(firstEl, { clearProps: "all" });
        const elRect = firstEl.getBoundingClientRect();
        const elCenterX = elRect.left + elRect.width / 2;
        const elCenterY = elRect.top + elRect.height / 2;
        fromX = deckCenter.x - elCenterX;
        fromY = deckCenter.y - elCenterY;
      }
    }

    cardRefs.value.forEach((el, i) => {
      if (!el) return;
      const cardId = props.cards[i];
      const isNew = cardId && newCardIds.includes(cardId);

      if (isNew) {
        // New card from deck: start from deck position
        gsap.set(el, {
          x: fromX,
          y: fromY,
          rotation: 0,
          scale: 0.4,
          opacity: 0,
        });
      } else if (hasReturnedCards) {
        // Existing card: briefly hidden for re-fan
        gsap.set(el, { opacity: 0 });
      } else {
        // First mount (no previous hand): classic entrance from below
        gsap.set(el, { x: 0, y: 80, rotation: 0, scale: 0.8, opacity: 0 });
      }
    });

    let newCardAnimIndex = 0;
    cardRefs.value.forEach((el, i) => {
      if (!el) return;
      const base = getBaseTransform(i);
      const cardId = props.cards[i];
      const isNew = cardId && newCardIds.includes(cardId);

      if (isNew) {
        // Play a flip SFX staggered to match each card's animation
        const sfxDelay = newCardAnimIndex * 100 + 150;
        setTimeout(() => playSfx(SFX.cardFlip), sfxDelay);
      }

      gsap.to(el, {
        x: base.x,
        y: base.y,
        rotation: base.rotation,
        scale: 1,
        opacity: 1,
        duration: isNew ? 0.55 : hasReturnedCards ? 0.3 : 0.6,
        delay: isNew
          ? newCardAnimIndex++ * 0.1 + 0.15
          : hasReturnedCards
            ? 0
            : i * 0.06,
        ease: isNew
          ? "power3.out"
          : hasReturnedCards
            ? "power2.out"
            : "back.out(1.4)",
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

    <!-- Card fan -->
    <div
      ref="handRef"
      class="hand-zone"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @mousemove="handlePointerMove"
      @touchmove.prevent="handlePointerMove"
      @touchstart="handleTouchStart"
      @click="handleHandClick"
    >
      <div class="hand-arc">
        <div
          v-for="(cardId, index) in props.cards"
          :key="cardId"
          ref="cardRefs"
          class="hand-card hand-card--fan"
          :class="{
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
            gestureEnabled && allSelected
              ? onPointerDown($event, cardId, index)
              : undefined
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
          <WhiteCard
            :cardId="cardId"
            :text="props.cardTexts?.[cardId]?.text"
            :disableHover="true"
          />
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

.hand-arc {
  position: relative;
  width: 100%;
  height: 200px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

@media (max-width: 767px) {
  .hand-arc {
    height: 140px;
  }
}

/* ── Individual Card ──────────────────────────────────────────── */
.hand-card {
  cursor: pointer;
  transform-origin: center bottom;
  position: relative;
}

.hand-card--fan {
  position: absolute;
  bottom: 0;
  width: clamp(6rem, 12vw, 18rem);
  aspect-ratio: 3 / 4;
}

.hand-card--selected::after {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: 14px;
  border: 2px solid rgba(34, 197, 94, 0.8);
  pointer-events: none;
  animation: selection-pulse 2s ease-in-out infinite;
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
</style>
