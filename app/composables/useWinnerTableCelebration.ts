/**
 * Everything that fires on the table when a round winner is picked:
 * confetti (three flavours of it), the losing cards dimming and sliding off,
 * the winning card sliding to the centre with a spotlight, the screen shake,
 * and the "+1" badge that arcs from the card to the winner's pill.
 *
 * `winnerAnimating` deliberately stays true until the round resets rather
 * than clearing when the animation ends: the template uses it to keep every
 * grid cell rendered, and letting it flip early caused a CSS-class-driven
 * flex reflow that visually shifted the winner card behind the celebration
 * overlay.
 *
 * All deferred work (rAF loops, setTimeouts) is tracked and cancelled on
 * unmount — GameTable can disappear mid-celebration during a Teleportal
 * reconnect, and a confetti loop that outlives its component runs forever.
 */
import { ref, watch, nextTick, onBeforeUnmount, type Ref } from "vue";
import { gsap } from "gsap";
import confetti from "canvas-confetti";

const CONFETTI_COLORS = ["#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#a855f7"];

export interface WinnerTableCelebrationOptions {
  /** The winner the table should react to (optimistic or confirmed). */
  effectiveRoundWinner: () => string | null | undefined;
  /** True once a winner has been committed for the round. */
  winnerSelected: () => boolean;
  /** The local player's id, for the self-win corner blast. */
  myId: () => string;
  /** True once cards are laid out in the judging grid. */
  hasTransitionedToRow: () => boolean;
  /** The judging grid container. */
  cardContainerRef: Ref<HTMLElement | null>;
  /** Grid cell elements keyed by player id, populated by the template. */
  gridCellRefs: Ref<Record<string, HTMLElement | null>>;
}

export function useWinnerTableCelebration(
  options: WinnerTableCelebrationOptions,
) {
  const {
    effectiveRoundWinner,
    winnerSelected,
    myId,
    hasTransitionedToRow,
    cardContainerRef,
    gridCellRefs,
  } = options;

  // ── Score fly badge state ────────────────────────────────────────
  const scoreFly = ref<{
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null>(null);

  // Track whether the winner slide-to-center animation is in progress.
  // While true, the template keeps all grid-cells visible so GSAP can animate them.
  const winnerAnimating = ref(false);

  // ── Deferred-work tracking so nothing outlives the component ─────
  const timers = new Set<ReturnType<typeof setTimeout>>();

  function later(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }

  // ── Confetti ────────────────────────────────────────────────────
  // A single burst per side rather than a per-frame rAF spray — the old loop
  // called confetti() every animation frame for 3s, which visibly janked the
  // mouse while it ran.
  function fireConfetti() {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: CONFETTI_COLORS,
      startVelocity: 40,
      gravity: 0.9,
      ticks: 150,
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: CONFETTI_COLORS,
      startVelocity: 40,
      gravity: 0.9,
      ticks: 150,
    });

    // Big center burst
    later(() => {
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
        colors: CONFETTI_COLORS,
        startVelocity: 30,
        gravity: 0.8,
      });
    }, 200);
  }

  watch(winnerSelected, (selected) => {
    if (selected) fireConfetti();
  });

  // ── Self-win confetti: bottom-left corner blast when OUR card is picked ──
  watch(effectiveRoundWinner, (winnerId) => {
    if (!winnerId || winnerId !== myId()) return;

    // Immediate burst — angled upward/right from the bottom-left corner
    confetti({
      particleCount: 60,
      angle: 55,
      spread: 60,
      startVelocity: 45,
      origin: { x: 0.05, y: 0.95 },
      colors: CONFETTI_COLORS,
      gravity: 0.9,
      ticks: 120,
      scalar: 1.1,
    });

    // Delayed secondary burst for a layered feel
    later(() => {
      confetti({
        particleCount: 40,
        angle: 70,
        spread: 50,
        startVelocity: 35,
        origin: { x: 0.1, y: 0.98 },
        colors: CONFETTI_COLORS,
        gravity: 1.0,
        ticks: 100,
        scalar: 0.9,
      });
    }, 200);

    // Third burst — wider fan
    later(() => {
      confetti({
        particleCount: 30,
        angle: 45,
        spread: 80,
        startVelocity: 30,
        origin: { x: 0.02, y: 0.92 },
        colors: CONFETTI_COLORS,
        gravity: 1.1,
        ticks: 80,
      });
    }, 400);
  });

  // ── Winner slide-to-center animation ────────────────────────────
  watch(effectiveRoundWinner, async (winnerId, oldWinnerId) => {
    if (!winnerId || oldWinnerId) return; // only on first selection
    if (!hasTransitionedToRow()) return; // must be in grid mode

    const container = cardContainerRef.value;
    if (!container) return;

    winnerAnimating.value = true;

    await nextTick();

    const allCells = container.querySelectorAll<HTMLElement>(".grid-cell");
    const winnerCell = gridCellRefs.value[winnerId];

    if (!winnerCell) {
      winnerAnimating.value = false;
      return;
    }

    // ── Animate losing cells out (dim + blur + scale) ──────────
    const nonWinnerCells: HTMLElement[] = [];
    allCells.forEach((cell) => {
      const cardEl = cell.querySelector<HTMLElement>(".unified-card");
      if (cardEl?.dataset.playerId === winnerId) return;

      nonWinnerCells.push(cell);
      gsap.to(cell, {
        opacity: 0.3,
        scale: 0.85,
        filter: "blur(3px)",
        duration: 0.45,
        ease: "power2.out",
      });
    });

    // ── Strip cell chrome from the winner so only the card slides ──
    gsap.set(winnerCell, {
      borderColor: "transparent",
      background: "transparent",
      boxShadow: "none",
    });

    // ── Slide winning card to the horizontal center of the table ──
    // Use the table-center parent for a visually accurate center.
    const tableCenter = container.closest(".table-center");
    const anchorRect = (tableCenter ?? container).getBoundingClientRect();
    const winnerRect = winnerCell.getBoundingClientRect();

    const dx =
      anchorRect.left +
      anchorRect.width / 2 -
      (winnerRect.left + winnerRect.width / 2);

    gsap.to(winnerCell, {
      x: dx,
      duration: 0.6,
      ease: "power3.out",
      // Do NOT clear winnerAnimating here — see the note at the top of this file.
    });

    // ── Winner spotlight: golden glow + scale-up ─────────────────
    gsap.to(winnerCell, {
      scale: 1.05,
      duration: 0.5,
      ease: "back.out(1.7)",
      onStart: () => winnerCell.classList.add("winner-spotlight"),
    });

    // ── Screen shake ─────────────────────────────────────────────
    const tableRoot = document.querySelector(".game-table-root");
    if (tableRoot) {
      tableRoot.classList.add("screen-shake");
      later(() => tableRoot.classList.remove("screen-shake"), 250);
    }

    // ── Localized confetti burst from winner card position ────────
    const winnerBurstRect = winnerCell.getBoundingClientRect();
    const from = {
      x: winnerBurstRect.left + winnerBurstRect.width / 2,
      y: winnerBurstRect.top + winnerBurstRect.height / 2,
    };

    confetti({
      particleCount: 40,
      spread: 55,
      origin: {
        x: from.x / window.innerWidth,
        y: from.y / window.innerHeight,
      },
      colors: ["#eab308", "#a78bfa", "#e2e8f0"],
      startVelocity: 20,
      gravity: 0.8,
      ticks: 80,
    });

    // ── Score fly badge: arc +1 from winner card to winner pill in header ──
    const pillEl = document.querySelector(
      `[data-player-pill="${winnerId}"]`,
    ) as HTMLElement | null;
    const pillRect = pillEl?.getBoundingClientRect();
    scoreFly.value = {
      from,
      to: pillRect
        ? {
            x: pillRect.left + pillRect.width / 2,
            y: pillRect.top + pillRect.height / 2,
          }
        : { x: window.innerWidth / 2, y: 50 },
    };

    // ── Slide losing cards off-table edges after spotlight settles ─
    later(() => {
      nonWinnerCells.forEach((cell, i) => {
        const direction = i % 2 === 0 ? -1 : 1;
        gsap.to(cell, {
          x: direction * 300,
          opacity: 0,
          rotation: direction * 15,
          duration: 0.4,
          delay: i * 0.05,
          ease: "power2.in",
        });
      });
    }, 800);
  });

  /**
   * Clear the celebration's GSAP state at a round boundary. Without this the
   * transforms applied to grid cells above survive into the next round's
   * layout.
   */
  function resetForNewRound() {
    winnerAnimating.value = false;

    const container = cardContainerRef.value;
    if (!container) return;
    container.querySelectorAll<HTMLElement>(".grid-cell").forEach((cell) => {
      gsap.killTweensOf(cell);
      gsap.set(cell, { clearProps: "all" });
    });
  }

  onBeforeUnmount(() => {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  });

  return {
    scoreFly,
    winnerAnimating,
    resetForNewRound,
  };
}
