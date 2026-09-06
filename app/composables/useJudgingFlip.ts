/**
 * The pile → judging-grid transition for GameTable.
 *
 * When the round moves to judging, submissions are shuffled once (so the
 * judge can't infer who played what from ordering) and the cards perform a
 * FLIP animation: their pile positions are measured *before* the layout
 * switch, the grid is rendered, and each card is then tweened from where it
 * used to be into where it now is.
 *
 * The shuffle happens exactly once per round — re-shuffling on any later
 * re-render would visibly reorder cards under the judge's cursor.
 *
 * Driven by the caller's *local* phase, which GameTable delays by ~1s after
 * the real phase change so the last card's fly-in can land before the layout
 * moves out from under it.
 */
import { ref, watch, nextTick, onMounted, type Ref } from "vue";
import { gsap } from "gsap";
import { shuffle } from "lodash-es";
import type { CardAngle } from "~/composables/useCardPileChoreography";

export interface Submission {
  playerId: string;
  cards: string[];
}

export interface JudgingFlipOptions {
  /** Current submissions map (player id → card ids). */
  submissions: () => Record<string, string[]>;
  /** GameTable's *local* (delayed) phase. */
  phase: () => "submitting" | "judging";
  /** The card container; pile positions are measured from its children. */
  cardContainerRef: Ref<HTMLElement | null>;
  /** Grid cell elements keyed by player id, populated by the template. */
  gridCellRefs: Ref<Record<string, HTMLElement | null>>;
  /** Reads a pile card's resting rotation without creating one. */
  peekCardAngle: (playerId: string) => CardAngle | undefined;
}

export function useJudgingFlip(options: JudgingFlipOptions) {
  const { submissions, phase, cardContainerRef, gridCellRefs, peekCardAngle } =
    options;

  // Shuffled submission order (set once when judging starts, not re-shuffled)
  const shuffledOrder = ref<Submission[]>([]);

  // Track if we've already transitioned cards from pile → row
  const hasTransitionedToRow = ref(false);

  // Show judging UI (labels, buttons) only after FLIP animation completes
  const showJudgingUI = ref(false);

  function snapshotSubmissions(): Submission[] {
    return Object.entries(submissions()).map(([playerId, cards]) => ({
      playerId,
      cards,
    }));
  }

  /**
   * Animate every card from its pile position into its grid cell.
   * `firstRects` is the FIRST half of the FLIP, captured before the layout
   * switch; this runs after the grid has mounted and measured.
   */
  function playFlipInto(firstRects: Map<string, DOMRect>) {
    shuffledOrder.value.forEach((sub, index) => {
      const pid = sub.playerId;
      const cellEl = gridCellRefs.value[pid];
      if (!cellEl) return;

      // Find the card element inside its cell (it's been moved by v-for)
      const cardEl = cellEl.querySelector<HTMLElement>(
        `[data-player-id="${pid}"]`,
      );
      if (!cardEl) return;

      const firstRect = firstRects.get(pid);
      const lastRect = cardEl.getBoundingClientRect();
      if (!firstRect || !lastRect) return;

      const dx = firstRect.left - lastRect.left;
      const dy = firstRect.top - lastRect.top;
      const rotate = peekCardAngle(pid)?.rotate || 0;

      gsap.fromTo(
        cardEl,
        { x: dx, y: dy, rotation: rotate, scale: 0.75, opacity: 1 },
        {
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          opacity: 1,
          duration: 0.7,
          delay: index * 0.06,
          ease: "back.out(1.4)",
          clearProps: "all",
          onComplete: () => {
            if (index === shuffledOrder.value.length - 1) {
              showJudgingUI.value = true;
            }
          },
        },
      );
    });

    // Fallback: if no cards to animate, show UI immediately
    if (shuffledOrder.value.length === 0) showJudgingUI.value = true;
  }

  // ── Judging: shuffle once & FLIP animate when phase changes ─────
  watch(
    phase,
    (newPhase, oldPhase) => {
      if (newPhase !== "judging" || oldPhase !== "submitting") return;

      shuffledOrder.value = shuffle(snapshotSubmissions());
      hasTransitionedToRow.value = false;
      showJudgingUI.value = false;

      const container = cardContainerRef.value;
      if (!container) {
        // No container ref — fallback to instant transition
        hasTransitionedToRow.value = true;
        showJudgingUI.value = true;
        return;
      }

      // 1. Capture the FIRST positions (pile layout)
      const firstRects = new Map<string, DOMRect>();
      container
        .querySelectorAll<HTMLElement>(".unified-card")
        .forEach((el) => {
          const pid = el.dataset.playerId;
          if (pid) firstRects.set(pid, el.getBoundingClientRect());
        });

      // 2. Switch to grid layout
      nextTick(() => {
        hasTransitionedToRow.value = true;

        // 3. Wait for grid to mount (double-tick: nextTick for the v-if swap,
        //    then rAF so the browser has actually laid the grid out)
        nextTick(() => {
          requestAnimationFrame(() => playFlipInto(firstRects));
        });
      });
    },
    { immediate: true },
  );

  // Initialize shuffled order if already in judging phase on mount
  onMounted(() => {
    if (phase() !== "judging") return;
    if (shuffledOrder.value.length === 0) {
      shuffledOrder.value = shuffle(snapshotSubmissions());
    }
    hasTransitionedToRow.value = true;
    showJudgingUI.value = true;
  });

  return {
    shuffledOrder,
    hasTransitionedToRow,
    showJudgingUI,
  };
}
