/**
 * Composable that adds drag & flick gesture support to card elements.
 *
 * Uses the Pointer Events API for unified mouse + touch handling.
 * When a selected card is dragged toward the table pile and released,
 * or when it is flicked upward with enough velocity, all selected
 * cards are submitted together.
 *
 * This composable does NOT handle card selection — that is still
 * managed by UserHand.vue via click/tap toggling.
 */
import { ref, type Ref, onUnmounted } from "vue";
import { gsap } from "gsap";

/* ── Types ─────────────────────────────────────────────────────────── */

interface PointerSample {
  x: number;
  y: number;
  t: number;
}

interface Velocity {
  vx: number;
  vy: number;
  speed: number;
}

export interface CardGestureOptions {
  /** Reactive array of card DOM elements (from v-for template refs) */
  cardRefs: Ref<HTMLElement[]>;
  /** Reactive array of currently selected card IDs */
  selectedCards: Ref<string[]>;
  /** Full card ID list from props */
  cards: Ref<string[]>;
  /** Returns the fan-layout base transform for card at index i */
  getBaseTransform: (i: number) => { x: number; y: number; rotation: number };
  /** Callback: snapshot selected cards and emit submission.
   *  Receives pre-snapshotted card elements for fly-coord capture
   *  (elements are provided BEFORE the fling animation mutates them). */
  onSubmit: (cardIds: string[], preSnapshotEls: HTMLElement[]) => void;
  /** Whether gestures are currently enabled */
  enabled: Ref<boolean>;
  /** Whether the component is disabled (judge, already submitted, etc.) */
  disabled: Ref<boolean>;
}

/* ── Constants ─────────────────────────────────────────────────────── */

/** Minimum pointer speed (px / ms) to qualify as a fling */
const FLICK_SPEED_THRESHOLD = 0.6;
/** Number of recent pointer samples used for velocity calculation */
const MAX_SAMPLES = 5;
/** CSS selector for the drop zone (submission pile on the game table) */
const DROP_ZONE_SELECTOR = ".unified-card-container--pile";
/** Minimum distance in px before a pointer-down becomes a drag */
const DRAG_THRESHOLD = 10;

/* ── Composable ────────────────────────────────────────────────────── */

export function useCardGesture(opts: CardGestureOptions) {
  const {
    cardRefs,
    selectedCards,
    cards,
    getBaseTransform,
    onSubmit,
    enabled,
    disabled,
  } = opts;

  /* Drag state */
  const isDragging = ref(false);
  let isPending = false; // pointerdown received but threshold not crossed
  let dragPointerId = -1;
  let dragIndex = -1;
  let dragCardId = "";
  let dragStartX = 0;
  let dragStartY = 0;
  /** Base transforms captured at drag-start so we can offset from them */
  let dragBaseTransforms: Map<
    number,
    { x: number; y: number; rotation: number }
  > = new Map();
  const pointerHistory: PointerSample[] = [];

  /* ── Velocity helper ────────────────────────────────────────────── */

  function calculateVelocity(): Velocity {
    if (pointerHistory.length < 2) return { vx: 0, vy: 0, speed: 0 };
    const first = pointerHistory[0]!;
    const last = pointerHistory[pointerHistory.length - 1]!;
    const dt = last.t - first.t;
    if (dt === 0) return { vx: 0, vy: 0, speed: 0 };
    const vx = (last.x - first.x) / dt;
    const vy = (last.y - first.y) / dt;
    return { vx, vy, speed: Math.sqrt(vx * vx + vy * vy) };
  }

  /* ── Drop zone hit-test ─────────────────────────────────────────── */

  function isOverDropZone(clientX: number, clientY: number): boolean {
    const dropZone = document.querySelector(DROP_ZONE_SELECTOR);
    if (!dropZone) return false;
    const rect = dropZone.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  /* ── Get indices of all selected cards ──────────────────────────── */

  function getSelectedIndices(): number[] {
    const indices: number[] = [];
    for (let i = 0; i < cards.value.length; i++) {
      if (selectedCards.value.includes(cards.value[i] ?? "")) {
        indices.push(i);
      }
    }
    return indices;
  }

  /* ── Pointer handlers ───────────────────────────────────────────── */

  function onPointerDown(e: PointerEvent, cardId: string, index: number) {
    if (!enabled.value || disabled.value) return;
    // Only allow gesture on selected cards (or if this is the only card needed)
    if (!selectedCards.value.includes(cardId)) return;

    // Enter pending state — don't commit to dragging yet
    isPending = true;
    isDragging.value = false;
    dragIndex = index;
    dragCardId = cardId;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragPointerId = e.pointerId;

    // Reset pointer history
    pointerHistory.length = 0;
    pointerHistory.push({ x: e.clientX, y: e.clientY, t: performance.now() });

    // Capture pointer for reliable tracking (works even outside the element)
    const el = cardRefs.value[index];
    if (el) {
      el.setPointerCapture(e.pointerId);
    }

    // Don't preventDefault here — allow click to fire if threshold isn't crossed
  }

  /** Promote from pending → real drag (called once threshold is crossed) */
  function commitDrag() {
    isPending = false;
    isDragging.value = true;

    // Capture base transforms for all selected cards
    dragBaseTransforms.clear();
    const selectedIndices = getSelectedIndices();
    for (const idx of selectedIndices) {
      const el = cardRefs.value[idx];
      if (!el) continue;
      // Read current GSAP-applied transform
      dragBaseTransforms.set(idx, {
        x: gsap.getProperty(el, "x") as number,
        y: gsap.getProperty(el, "y") as number,
        rotation: gsap.getProperty(el, "rotation") as number,
      });
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPending && !isDragging.value) return;

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    // Check threshold before committing to drag
    if (isPending) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      commitDrag();
    }

    // Track pointer samples for velocity
    pointerHistory.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (pointerHistory.length > MAX_SAMPLES) pointerHistory.shift();

    // Move all selected cards as a group
    for (const [idx, base] of dragBaseTransforms) {
      const el = cardRefs.value[idx];
      if (!el) continue;
      gsap.set(el, {
        x: base.x + dx,
        y: base.y + dy,
        rotation: base.rotation + dx * 0.08, // subtle rotation following drag
        scale: 1.1,
        zIndex: 200,
      });
    }

    e.preventDefault();
  }

  function onPointerUp(e: PointerEvent) {
    // If still pending (no drag committed), release and let click fire
    if (isPending) {
      isPending = false;
      const el = cardRefs.value[dragIndex];
      if (el) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* ok */
        }
      }
      dragIndex = -1;
      dragCardId = "";
      pointerHistory.length = 0;
      return;
    }
    if (!isDragging.value) return;
    isDragging.value = false;

    const velocity = calculateVelocity();
    const isUpward = velocity.vy < 0;
    const isFastEnough = velocity.speed > FLICK_SPEED_THRESHOLD;
    const isOverDrop = isOverDropZone(e.clientX, e.clientY);

    const selectedIndices = getSelectedIndices();

    if ((isFastEnough && isUpward) || isOverDrop) {
      // ── SUCCESS: Fling or drop ─────────────────────────────────

      // CRITICAL: Snapshot the card elements NOW, while they still have
      // correct transforms and are fully visible. The fling animation
      // will immediately start fading/scaling them, making later
      // getBoundingClientRect() calls return garbage coordinates.
      const preSnapshotEls = selectedIndices
        .map((idx) => cardRefs.value[idx])
        .filter((el): el is HTMLElement => !!el);
      const submittedCardIds = [...selectedCards.value];

      for (const idx of selectedIndices) {
        const el = cardRefs.value[idx];
        if (!el) continue;

        if (isFastEnough && isUpward) {
          // Fling: continue momentum
          gsap.to(el, {
            x: `+=${velocity.vx * 150}`,
            y: `+=${velocity.vy * 150}`,
            rotation: `+=${velocity.vx * 25}`,
            scale: 0.7,
            opacity: 0,
            duration: 0.4,
            ease: "power2.out",
          });
        } else {
          // Drop: snap to center of drop zone
          const dropZone = document.querySelector(DROP_ZONE_SELECTOR);
          if (dropZone) {
            const dropRect = dropZone.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const targetX =
              dropRect.left +
              dropRect.width / 2 -
              (elRect.left + elRect.width / 2);
            gsap.to(el, {
              x: `+=${targetX}`,
              y: "-=100",
              scale: 0.7,
              opacity: 0,
              duration: 0.35,
              ease: "power2.in",
            });
          }
        }
      }

      // Fire submission after animation (with pre-captured elements)
      setTimeout(() => {
        onSubmit(submittedCardIds, preSnapshotEls);
      }, 250);
    } else {
      // ── CANCEL: Rubber-band back ───────────────────────────────
      for (const idx of selectedIndices) {
        const el = cardRefs.value[idx];
        if (!el) continue;
        const base = getBaseTransform(idx);
        // Maintain the selected lift offset
        gsap.to(el, {
          x: base.x,
          y: base.y - 25, // selected cards are lifted 25px
          rotation: base.rotation,
          scale: 1.05,
          zIndex: 90,
          duration: 0.5,
          ease: "elastic.out(1, 0.5)",
        });
      }
    }

    // Release pointer capture
    const el = cardRefs.value[dragIndex];
    if (el) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may already be released
      }
    }

    // Cleanup
    dragIndex = -1;
    dragCardId = "";
    dragBaseTransforms.clear();
    pointerHistory.length = 0;
  }

  /* ── Cleanup ────────────────────────────────────────────────────── */

  function cancelDrag() {
    isPending = false;
    if (!isDragging.value) return;
    isDragging.value = false;

    const selectedIndices = getSelectedIndices();
    for (const idx of selectedIndices) {
      const el = cardRefs.value[idx];
      if (!el) continue;
      const base = getBaseTransform(idx);
      gsap.to(el, {
        x: base.x,
        y: base.y - 25,
        rotation: base.rotation,
        scale: 1.05,
        zIndex: 90,
        duration: 0.4,
        ease: "back.out(1.2)",
      });
    }

    dragIndex = -1;
    dragCardId = "";
    dragBaseTransforms.clear();
    pointerHistory.length = 0;
  }

  onUnmounted(() => {
    cancelDrag();
  });

  return {
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    cancelDrag,
  };
}
