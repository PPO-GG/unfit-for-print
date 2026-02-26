<script lang="ts" setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import type { Player } from "~/types/player";
import type { CardTexts } from "~/types/gamecards";
import { gsap } from "gsap";
import confetti from "canvas-confetti";
import { shuffle } from "lodash-es";
import { useCardFlyCoords } from "~/composables/useCardFlyCoords";
import { useCardPlayPreferences } from "~/composables/useCardPlayPreferences";
import { mergeCardText } from "~/composables/useMergeCards";
import { SFX, SPRITES } from "~/config/sfx.config";
import GameTableSeats from "./GameTableSeats.vue";

interface BlackCard {
  id: string;
  text: string;
  pick: number;
  [key: string]: unknown;
}

interface Submission {
  playerId: string;
  cards: string[];
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
    revealedCards: Record<string, boolean>;
    effectiveRoundWinner?: string | null;
    confirmedRoundWinner?: string | null;
    winnerSelected: boolean;
    winningCards?: string[];
    scores?: Record<string, number>;
    judgeId?: string | null;
    /** Whether the TTS engine is currently speaking (driven by parent). */
    readingAloud?: boolean;
    /** Resolved card texts keyed by card ID — eliminates per-card Appwrite fetches. */
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
]);

const { t } = useI18n();
const { consumeCentroid } = useCardFlyCoords();
const { playMode, cycleMode } = useCardPlayPreferences();

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

  // Merge cardTexts prop + freshly resolved texts
  const whiteTexts = sub.map(
    (cardId) =>
      props.cardTexts?.[cardId]?.text ?? resolvedTexts[cardId]?.text ?? "",
  );

  const merged = mergeCardText(props.blackCard.text, whiteTexts);
  if (!merged) return;

  emit("read-aloud", merged);
}

// Sprite-based SFX for card landing sounds
const { playSfx: playCardLandSfx } = useSfx(
  SPRITES.cardLand.src,
  SPRITES.cardLand.map,
);
// General SFX (individual files)
const { playSfx } = useSfx();

// ── Child component refs ────────────────────────────────────────
const seatsRef = ref<InstanceType<typeof GameTableSeats> | null>(null);

// Accessor for seat element refs from the child component
const seatRefs = computed(() => seatsRef.value?.seatRefs ?? {});

// ── State ───────────────────────────────────────────────────────
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

const tableRef = ref<HTMLElement | null>(null);
const pileAreaRef = ref<HTMLElement | null>(null);
const cardContainerRef = ref<HTMLElement | null>(null);
const ghostTemplateRef = ref<HTMLElement | null>(null);

// Track previous submissions for fly-in animations
const prevSubmissionKeys = ref<Set<string>>(new Set());

// Shuffled submission order (set once when judging starts, not re-shuffled)
const shuffledOrder = ref<Submission[]>([]);

// Track if we've already transitioned cards from pile → row
const hasTransitionedToRow = ref(false);

// Track whether the FLIP animation is currently running
const isFlipAnimating = ref(false);

// Track random angles for thrown cards (stable per player).
// Plain object (non-reactive) so that caching a new card's angle
// doesn't trigger Vue re-renders on every existing pile card.
let cardAngles: Record<string, { rotate: number; tx: number; ty: number }> = {};

// Show judging UI (labels, buttons) only after FLIP animation completes
const showJudgingUI = ref(false);

// Track whether the winner slide-to-center animation is in progress.
// While true, the template keeps all grid-cells visible so GSAP can animate them.
const winnerAnimating = ref(false);

// ── Grid cell refs for FLIP targeting ───────────────────────────
const gridCellRefs = ref<Record<string, HTMLElement | null>>({});

// ── Optimal grid columns based on submission count ──────────────
const gridCols = computed(() => {
  const count = displaySubmissions.value.length;
  if (count <= 2) return 2;
  if (count <= 3) return 3;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  if (count <= 8) return 4;
  return 4;
});

// ── Total card density for responsive judging grid sizing ───────
const totalCardDensity = computed(() => {
  const subs = displaySubmissions.value.length;
  const pick = props.blackCard?.pick || 1;
  return subs * pick;
});

// Density class drives CSS-level card sizing + overlap in the judging grid
const densityClass = computed(() => {
  const density = totalCardDensity.value;
  if (density <= 4) return "";
  if (density <= 6) return "judging-grid--medium";
  if (density <= 8) return "judging-grid--dense";
  return "judging-grid--very-dense";
});

// ── Submission helpers ──────────────────────────────────────────
function getPlayerName(playerId: string): string {
  const p = props.players.find(
    (pl) => pl.userId === playerId || pl.$id === playerId,
  );
  return p?.name || t("lobby.unknown_player");
}

function getPlayerScore(playerId: string): number {
  return props.scores?.[playerId] ?? 0;
}

const submissionCount = computed(() => Object.keys(props.submissions).length);
const totalParticipants = computed(
  () => props.players.filter((p) => p.playerType !== "spectator").length - 1,
);

//* ── Random card scatter for natural pile feel ────────────────────
// Each card gets a fully random rotation, direction, and distance
// from center, producing a messy, organic pile that looks different
// every round. Cached per player so angles stay stable within a round.
function getCardAngle(playerId: string) {
  if (!cardAngles[playerId]) {
    // Fully random rotation between -25° and +25°
    const rotate = (Math.random() - 0.5) * 50;

    // Random direction (any angle around the center)
    const theta = Math.random() * Math.PI * 2;

    // Random distance from center (15–60px)
    const radius = 15 + Math.random() * 45;

    cardAngles[playerId] = {
      rotate,
      tx: Math.cos(theta) * radius,
      ty: Math.sin(theta) * radius,
    };
  }
  return cardAngles[playerId];
}

// ── Position a pile card at its scatter offset via GSAP ──────────
// Also sets opacity: 1 because .unified-card--pile defaults to opacity: 0
// to prevent flash-of-unstyled-card before GSAP takes control.
function setPilePosition(el: HTMLElement, pid: string) {
  const angle = getCardAngle(pid);
  gsap.set(el, {
    x: angle.tx,
    y: angle.ty,
    rotation: angle.rotate,
    opacity: 1,
  });
}

// ── Fly-in animation for new submissions ────────────────────────
// Guard: track which player IDs have already been animated this round
// to prevent duplicate fly-ins when the deep watcher fires multiple times.
const animatedPids = new Set<string>();
// Track pids with in-flight ghost animations (real card stays hidden)
const flyingGhosts = ref<Set<string>>(new Set());
// Optimistic ghosts that must persist until the real pile card arrives
const pendingOptimisticGhosts = new Map<string, HTMLElement>();

// Vue-controlled pile card positioning. Returns the inline style for
// each pile card so Vue maintains positions through re-renders.
function getPileCardStyle(pid: string) {
  // Hide real card while ghost is flying
  if (flyingGhosts.value.has(pid)) return { opacity: 0 };
  const angle = cardAngles[pid];
  if (!angle) return { opacity: 0 }; // not yet positioned
  return {
    transform: `translate(${angle.tx}px, ${angle.ty}px) rotate(${angle.rotate}deg)`,
    opacity: 1,
  };
}

// ── Round-reset: clear animation state when a new round begins ──
// Uses the phase prop as the authoritative round-boundary signal,
// NOT the submissions emptying (which can happen transiently during
// Appwrite realtime state updates, causing all cards to re-animate).
watch(
  () => props.phase,
  (newPhase, oldPhase) => {
    // When phase cycles back to "submitting" from "judging",
    // it's a new round — clear all animation trackers.
    if (newPhase === "submitting" && oldPhase === "judging") {
      animatedPids.clear();
      flyingGhosts.value.clear();
      // Clean up any lingering optimistic ghosts
      for (const ghost of pendingOptimisticGhosts.values()) ghost.remove();
      pendingOptimisticGhosts.clear();
      cardAngles = {};
      prevSubmissionKeys.value = new Set();
      winnerAnimating.value = false;

      // Clear GSAP transforms from grid cells to prevent stale state
      const container = cardContainerRef.value;
      if (container) {
        const cells = container.querySelectorAll<HTMLElement>(".grid-cell");
        cells.forEach((cell) => {
          gsap.killTweensOf(cell);
          gsap.set(cell, { clearProps: "all" });
        });
      }
    }
  },
);

watch(
  () => props.submissions,
  async (newSubs) => {
    const newKeys = new Set(Object.keys(newSubs));
    const addedKeys: string[] = [];
    for (const key of newKeys) {
      if (!prevSubmissionKeys.value.has(key) && !animatedPids.has(key)) {
        flyingGhosts.value.add(key); // hide real card BEFORE angle is set
        getCardAngle(key);
        addedKeys.push(key);
        animatedPids.add(key);
      }
      // Clean up optimistic ghost now that the real pile card exists
      const ghost = pendingOptimisticGhosts.get(key);
      if (ghost) {
        ghost.remove();
        pendingOptimisticGhosts.delete(key);
        flyingGhosts.value.delete(key);
      }
    }

    prevSubmissionKeys.value = newKeys;

    // NOTE: Round-reset is now handled by the phase watcher above.
    // Do NOT clear animatedPids here when newKeys.size === 0, because
    // transient empty states from Appwrite realtime re-parsing would
    // cause every subsequent submission to re-animate all cards.

    if (addedKeys.length === 0 || !isSubmitting.value) return;

    // Wait for Vue to render the new card elements
    await nextTick();
    await nextTick(); // double nextTick ensures DOM is fully flushed

    const container = cardContainerRef.value;
    if (!container) return;

    addedKeys.forEach((pid, animIndex) => {
      const el = container.querySelector(
        `[data-player-id="${pid}"]`,
      ) as HTMLElement;

      if (!el) return;

      const finalAngle = getCardAngle(pid);
      let isLocal = pid === props.myId;

      // ── Step 1: Measure the pile card's final screen position ──────
      // Temporarily place it at the pile position to measure.
      setPilePosition(el, pid);
      const elRect = el.getBoundingClientRect();
      const destX = elRect.left + elRect.width / 2;
      const destY = elRect.top + elRect.height / 2;

      const cardWidth = el.offsetWidth;
      const cardHeight = el.offsetHeight;

      // Re-hide the real card immediately after measuring so it doesn't
      // flash at the destination while the ghost clone flies in.
      gsap.set(el, { opacity: 0 });

      // ── Step 2: Determine where the card should fly FROM ──────────
      let fromX = destX;
      let fromY = destY;

      if (isLocal) {
        const centroid = consumeCentroid();
        if (centroid) {
          fromX = centroid.x;
          fromY = centroid.y;
        } else {
          fromY = window.innerHeight + 200;
        }
      } else {
        const seatEl = seatRefs.value[pid];
        if (seatEl) {
          const seatRect = seatEl.getBoundingClientRect();
          fromX = seatRect.left + seatRect.width / 2;
          fromY = seatRect.top + seatRect.height / 2;
        } else {
          fromX = destX + (Math.random() - 0.5) * 200;
          fromY = -200;
        }
      }

      // ── Step 3: Mark as flying, create a ghost clone ───────────────
      // The ghost lives outside Vue's control so reactivity can't kill it.
      // Mark in reactive set so Vue hides the real card via :style binding.
      flyingGhosts.value.add(pid);
      const ghost = el.cloneNode(true) as HTMLElement;
      // Strip ALL classes to remove conflicting .unified-card--pile rules
      // (inset: 0, margin: auto, opacity: 0, position: absolute)
      ghost.className = "";
      ghost.style.cssText = `
        position: fixed;
        left: 0;
        top: 0;
        width: ${cardWidth}px;
        height: ${cardHeight}px;
        pointer-events: none;
        z-index: 9999;
        opacity: 1;
      `;
      document.body.appendChild(ghost);

      // Physics-based spin
      const spinDirection = Math.random() > 0.5 ? 1 : -1;
      const startRotation =
        finalAngle.rotate +
        spinDirection *
          (isLocal ? 60 + Math.random() * 60 : 360 + Math.random() * 180);

      // ── Step 4: Animate the ghost from source → destination ────────
      // Ghost uses position:fixed with left:0;top:0, so GSAP x/y are
      // screen coordinates directly.
      gsap.fromTo(
        ghost,
        {
          x: fromX - cardWidth / 2,
          y: fromY - cardHeight / 2,
          rotation: startRotation,
          scale: isLocal ? 1.05 : 0.15,
        },
        {
          x: destX - cardWidth / 2,
          y: destY - cardHeight / 2,
          rotation: finalAngle.rotate,
          scale: 1,
          duration: isLocal ? 0.6 : 0.8,
          delay: animIndex * 0.2,
          ease: "power3.out",
          onStart: () => {
            if (!isLocal) {
              playSfx(SFX.cardSelect, {
                volume: [0.3, 0.5],
                pitch: [0.9, 1.1],
              });
            }
          },
          onComplete: () => {
            // Remove ghost, let Vue reveal the real pile card via :style
            ghost.remove();
            flyingGhosts.value.delete(pid);

            playCardLandSfx("", {
              volume: isLocal ? [0.7, 0.9] : [0.4, 0.6],
              pitch: [0.9, 1.1],
            });
          },
        },
      );
    });
  },
  { deep: true },
);

// ── Judging: shuffle once & FLIP animate when phase changes ─────
watch(
  localPhase,
  (newPhase, oldPhase) => {
    if (newPhase === "judging" && oldPhase === "submitting") {
      // Shuffle submissions for judging
      const subs = Object.entries(props.submissions).map(([pid, cards]) => ({
        playerId: pid,
        cards,
      }));
      shuffledOrder.value = shuffle(subs);
      hasTransitionedToRow.value = false;
      showJudgingUI.value = false;

      // ── FLIP animation: capture pile positions, switch to grid, animate ──
      const container = cardContainerRef.value;
      if (container) {
        // 1. Capture the FIRST positions (pile layout)
        const cards = container.querySelectorAll<HTMLElement>(".unified-card");
        const firstRects = new Map<string, DOMRect>();
        cards.forEach((el) => {
          const pid = el.dataset.playerId;
          if (pid) firstRects.set(pid, el.getBoundingClientRect());
        });

        // 2. Switch to grid layout
        nextTick(() => {
          hasTransitionedToRow.value = true;
          isFlipAnimating.value = true;

          // 3. Wait for grid to mount (double-tick: nextTick for v-if swap, then rAF for layout)
          nextTick(() => {
            requestAnimationFrame(() => {
              // Animate each card from its pile position into its grid cell
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

                if (firstRect && lastRect) {
                  const dx = firstRect.left - lastRect.left;
                  const dy = firstRect.top - lastRect.top;
                  const angle = cardAngles[pid];
                  const rotate = angle?.rotate || 0;

                  gsap.fromTo(
                    cardEl,
                    {
                      x: dx,
                      y: dy,
                      rotation: rotate,
                      scale: 0.75,
                      opacity: 1,
                    },
                    {
                      x: 0,
                      y: 0,
                      rotation: 0,
                      scale: 1,
                      opacity: 1,
                      duration: 0.7,
                      delay: index * 0.1,
                      ease: "power3.out",
                      clearProps: "all",
                      onComplete: () => {
                        if (index === shuffledOrder.value.length - 1) {
                          isFlipAnimating.value = false;
                          showJudgingUI.value = true;
                        }
                      },
                    },
                  );
                }
              });

              // Fallback: if no cards to animate, show UI immediately
              if (shuffledOrder.value.length === 0) {
                isFlipAnimating.value = false;
                showJudgingUI.value = true;
              }
            });
          });
        });
      } else {
        // No container ref — fallback to instant transition
        hasTransitionedToRow.value = true;
        showJudgingUI.value = true;
      }
    }
  },
  { immediate: true },
);

// Initialize shuffled order if already in judging phase on mount
onMounted(() => {
  if (localPhase.value === "judging") {
    const subs = Object.entries(props.submissions).map(([pid, cards]) => ({
      playerId: pid,
      cards,
    }));
    if (shuffledOrder.value.length === 0) {
      shuffledOrder.value = shuffle(subs);
    }
    hasTransitionedToRow.value = true;
    showJudgingUI.value = true;
  }

  // Initialize previous submission keys AND mark them as already animated
  // so existing submissions (e.g. hot-reload, late join, page refresh)
  // don't trigger fly-in animations.
  const existingKeys = Object.keys(props.submissions);
  prevSubmissionKeys.value = new Set(existingKeys);
  existingKeys.forEach((pid) => animatedPids.add(pid));

  // Initialize card angles for any existing pile cards (e.g. hot-reload or late join)
  // Vue's :style binding via getPileCardStyle() handles the actual positioning
  if (localPhase.value === "submitting") {
    existingKeys.forEach((pid) => {
      getCardAngle(pid);
    });
  }
});

// ── Derived state ───────────────────────────────────────────────
const isSubmitting = computed(() => localPhase.value === "submitting");
const isJudging = computed(() => localPhase.value === "judging");

const displaySubmissions = computed(() => {
  if (isJudging.value && shuffledOrder.value.length > 0) {
    return shuffledOrder.value;
  }
  // During submission show all players' submissions
  return Object.entries(props.submissions).map(([pid, cards]) => ({
    playerId: pid,
    cards,
  }));
});

function isRevealed(playerId: string): boolean {
  return !!props.revealedCards?.[playerId];
}

const allRevealed = computed(() => {
  return displaySubmissions.value.every(
    (sub) => props.revealedCards?.[sub.playerId],
  );
});

// ── Confetti! ───────────────────────────────────────────────────
watch(
  () => props.winnerSelected,
  (selected) => {
    if (selected) {
      fireConfetti();
    }
  },
);

// ── Winner Slide-to-Center Animation ────────────────────────────
// When effectiveRoundWinner changes from null → a player ID, animate:
// 1. Losing cards fade + shrink out
// 2. Winning card slides to horizontal center of the table
// Note: winnerAnimating stays true until the round resets (phase-change
// watcher) — this prevents CSS class changes from causing a flex reflow
// that shifts the card behind the celebration overlay.
watch(
  () => props.effectiveRoundWinner,
  async (winnerId, oldWinnerId) => {
    if (!winnerId || oldWinnerId) return; // only on first selection
    if (!hasTransitionedToRow.value) return; // must be in grid mode

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

    // ── Animate losing cells out ────────────────────────────────
    allCells.forEach((cell) => {
      const cardEl = cell.querySelector<HTMLElement>(".unified-card");
      const pid = cardEl?.dataset.playerId;
      if (pid === winnerId) return;

      gsap.to(cell, {
        opacity: 0,
        scale: 0.85,
        duration: 0.45,
        ease: "power2.inOut",
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
    const anchorRect = tableCenter
      ? tableCenter.getBoundingClientRect()
      : container.getBoundingClientRect();
    const winnerRect = winnerCell.getBoundingClientRect();

    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    const winnerCenterX = winnerRect.left + winnerRect.width / 2;
    const dx = anchorCenterX - winnerCenterX;

    gsap.to(winnerCell, {
      x: dx,
      scale: 1.05,
      duration: 0.6,
      ease: "power3.out",
      // Do NOT set winnerAnimating = false here.
      // It stays true until the celebration overlay appears or the round resets.
      // This prevents CSS from hiding / reflowing the card.
    });
  },
);

// winnerAnimating stays true until the round resets (handled by the
// phase-change watcher). Resetting it when the celebration overlay
// appears caused a CSS-class-driven flex reflow that visually shifted
// the winner card behind the overlay.

function fireConfetti() {
  // Multiple bursts for a big celebration
  const duration = 3000;
  const end = Date.now() + duration;

  const colors = ["#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#a855f7"];

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };
  frame();

  // Big center burst
  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { x: 0.5, y: 0.5 },
      colors,
      startVelocity: 30,
      gravity: 0.8,
    });
  }, 200);
}

// ── Handlers ────────────────────────────────────────────────────
function handleCardSubmit(cardIds: string[]) {
  const pid = props.myId;
  const cardCount = cardIds.length;

  // ── Optimistic fly-in ─────────────────────────────────────────
  // Start the ghost animation IMMEDIATELY so the card visually leaves
  // the hand the instant the player clicks — before the server round-trip.
  // The submissions watcher will skip this pid because animatedPids
  // already contains it, preventing a duplicate animation.
  animatedPids.add(pid);
  getCardAngle(pid);
  flyingGhosts.value.add(pid);

  // Source: centroid snapshot set by UserHand.snapshotCards() just before emit
  const centroid = consumeCentroid();
  const fromX = centroid?.x ?? window.innerWidth / 2;
  const fromY = centroid?.y ?? window.innerHeight + 200;

  // Destination: center of the pile area
  const pileEl = pileAreaRef.value || cardContainerRef.value;
  let destX = window.innerWidth / 2;
  let destY = window.innerHeight / 3;
  if (pileEl) {
    const pileRect = pileEl.getBoundingClientRect();
    destX = pileRect.left + pileRect.width / 2;
    destY = pileRect.top + pileRect.height / 2;
  }

  // Measure card dimensions from the hidden template
  const tpl =
    ghostTemplateRef.value?.querySelector<HTMLElement>(".card-scaler");
  let cardWidth: number;
  let cardHeight: number;

  if (tpl) {
    const rect = tpl.getBoundingClientRect();
    cardWidth = rect.width;
    cardHeight = rect.height;
  } else {
    const vw12 = window.innerWidth * 0.12;
    cardWidth = Math.max(96, Math.min(288, vw12));
    cardHeight = cardWidth * (4 / 3);
  }

  const finalAngle = getCardAngle(pid);

  // Create one ghost per card for multi-pick visual feedback
  const ghosts: HTMLElement[] = [];
  for (let i = 0; i < cardCount; i++) {
    let ghost: HTMLElement;
    if (tpl) {
      ghost = tpl.cloneNode(true) as HTMLElement;
      ghost.className = "";
      ghost.style.cssText = `
        position: fixed; left: 0; top: 0;
        width: ${cardWidth}px; height: ${cardHeight}px;
        pointer-events: none; z-index: ${9999 - i}; opacity: 1;
      `;
    } else {
      ghost = document.createElement("div");
      ghost.style.cssText = `
        position: fixed; left: 0; top: 0; box-sizing: border-box;
        width: ${cardWidth}px; height: ${cardHeight}px;
        background: #e7e1de; border-radius: 12px;
        box-shadow: 0 8px 16px rgba(0,0,0,0.15);
        pointer-events: none; z-index: ${9999 - i}; opacity: 1;
        border: 6px solid rgba(0,0,0,0.25);
      `;
    }
    document.body.appendChild(ghost);
    ghosts.push(ghost);

    // Each card gets a unique spin and a visibly fanned landing position
    const cardRotOffset = cardCount > 1 ? (i - (cardCount - 1) / 2) * 8 : 0;
    const cardTxOffset = cardCount > 1 ? (i - (cardCount - 1) / 2) * 30 : 0;
    const cardTyOffset = cardCount > 1 ? i * 6 : 0;
    const spinDir = Math.random() > 0.5 ? 1 : -1;
    const startRot =
      finalAngle.rotate + cardRotOffset + spinDir * (60 + Math.random() * 60);

    gsap.fromTo(
      ghost,
      {
        x: fromX - cardWidth / 2 + (i - (cardCount - 1) / 2) * 20,
        y: fromY - cardHeight / 2,
        rotation: startRot,
        scale: 1.05,
      },
      {
        x: destX - cardWidth / 2 + finalAngle.tx + cardTxOffset,
        y: destY - cardHeight / 2 + finalAngle.ty + cardTyOffset,
        rotation: finalAngle.rotate + cardRotOffset,
        scale: 1,
        duration: 0.6,
        delay: i * 0.12,
        ease: "power3.out",
        onComplete: () => {
          // Only the last ghost manages lifecycle — remove all ghosts
          // when the real pile card arrives via the submissions watcher.
          if (i === cardCount - 1) {
            // Wrap all ghosts in a container so a single Map entry cleans them all up
            const wrapper = document.createElement("div");
            wrapper.style.cssText =
              "position:fixed;top:0;left:0;pointer-events:none;z-index:9998;";
            ghosts.forEach((g) => wrapper.appendChild(g));
            document.body.appendChild(wrapper);
            pendingOptimisticGhosts.set(pid, wrapper);
            playCardLandSfx("", {
              volume: [0.7, 0.9],
              pitch: [0.9, 1.1],
            });
          }
        },
      },
    );
  }

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
    :class="{
      'game-table--no-hand':
        !isParticipant || !isSubmitting || isJudge || !!submissions[myId],
    }"
  >
    <!-- Hidden template card for cloning optimistic fly-in ghosts.
         Always rendered off-screen so we can clone a pixel-perfect
         face-down WhiteCard that matches the badge fly-in ghosts. -->
    <div ref="ghostTemplateRef" class="ghost-template" aria-hidden="true">
      <WhiteCard
        :flipped="true"
        :disable-hover="true"
        :flat="true"
        back-logo-url="/img/ufp.svg"
      />
    </div>

    <!-- Player Seats Arc + Overflow List -->
    <GameTableSeats
      ref="seatsRef"
      :players="players"
      :my-id="myId"
      :submissions="submissions"
      :judge-id="judgeId"
      :scores="scores"
      :round-winner="effectiveRoundWinner"
    />

    <!-- Table Center -->
    <div class="table-center">
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
                :flipped="true"
                :is-winner="false"
                :disable-hover="true"
                :flat="true"
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
        :class="densityClass"
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
                  :flipped="!isRevealed(sub.playerId)"
                  :is-winner="effectiveRoundWinner === sub.playerId"
                  :disable-hover="!isRevealed(sub.playerId)"
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
  </div>
</template>

<style scoped>
.game-table {
  position: relative;
  width: 100%;
  min-height: 50vh;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 5.5rem;
  padding-bottom: 8rem;
  transition: padding-bottom 0.5s ease;
}

.game-table--no-hand {
  padding-bottom: 0rem;
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
  padding: 0.75rem;
  width: 100%;
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

.grid-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed rgba(100, 116, 139, 0.25);
  border-radius: 0.75rem;
  background: rgba(30, 41, 59, 0.12);
  padding: 0.65rem;
  transition:
    border-color 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.grid-cell:hover:not(.grid-cell--hidden) {
  border-color: rgba(100, 116, 139, 0.4);
  background: rgba(30, 41, 59, 0.2);
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
  border: 2px dashed rgba(100, 116, 139, 0.3);
  border-radius: 12px;
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
    padding: 0.85rem;
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
.judging-grid--dense :deep(.card-scaler) {
  width: clamp(5.5rem, 11vw, 16rem);
}
.judging-grid--dense .grid-cell {
  padding: 0.5rem;
}

/* Very dense (9+ total cards — e.g. 5 players × Draw 2) */
.judging-grid--very-dense {
  gap: 0.65rem;
}
.judging-grid--very-dense :deep(.card-scaler) {
  width: clamp(5rem, 10vw, 14rem);
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
</style>
