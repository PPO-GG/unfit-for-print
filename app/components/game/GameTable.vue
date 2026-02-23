<script lang="ts" setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import type { Player } from "~/types/player";
import { gsap } from "gsap";
import confetti from "canvas-confetti";
import { shuffle } from "lodash-es";
import { useCardFlyCoords } from "~/composables/useCardFlyCoords";
import { useCardPlayPreferences } from "~/composables/useCardPlayPreferences";
import { SFX, SPRITES } from "~/config/sfx.config";

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
  },
);

const emit = defineEmits([
  "select-cards",
  "convert-to-player",
  "select-winner",
  "reveal-card",
]);

const { t } = useI18n();
const { consumeCentroid } = useCardFlyCoords();
const { playMode, cycleMode } = useCardPlayPreferences();

// Sprite-based SFX for card landing sounds
const { playSfx: playCardLandSfx } = useSfx(
  SPRITES.cardLand.src,
  SPRITES.cardLand.map,
);
// General SFX (individual files)
const { playSfx } = useSfx();

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

const seatRefs = ref<Record<string, HTMLElement | null>>({});
const tableRef = ref<HTMLElement | null>(null);
const pileAreaRef = ref<HTMLElement | null>(null);
const cardContainerRef = ref<HTMLElement | null>(null);

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

// ── Participants (excluding self) ───────────────────────────────
const participants = computed(() =>
  props.players.filter(
    (p) => p.playerType !== "spectator" && p.userId !== props.myId,
  ),
);

const MAX_SEATS = 6;
const seatedPlayers = computed(() => participants.value.slice(0, MAX_SEATS));
const overflowPlayers = computed(() => participants.value.slice(MAX_SEATS));

// ── Submission helpers ──────────────────────────────────────────
function hasSubmitted(playerId: string): boolean {
  return !!props.submissions[playerId];
}

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

// ── Seat positioning ────────────────────────────────────────────
function getSeatStyle(index: number, total: number) {
  const fraction = total <= 1 ? 0.5 : index / (total - 1);
  const x = 20 + fraction * 60;
  // Flatter arc for the docked top bar
  const arcDepth = 100;
  const yOffset = Math.pow(fraction - 0.5, 2) * 4 * arcDepth;
  return {
    left: `${x}%`,
    top: `${yOffset}px`,
    transform: "translateX(-50%)",
  };
}

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

// ── Winner name for celebration ─────────────────────────────────
// Use confirmedRoundWinner (snapshot at watcher time) for the overlay
// so it stays consistent with the notification and won't shift if
// state.roundWinner changes during the 2-second celebration delay.
const winnerName = computed(() => {
  const winner = props.confirmedRoundWinner || props.effectiveRoundWinner;
  if (!winner) return "";
  if (winner === props.myId) return t("game.you");
  return getPlayerName(winner);
});

const isWinnerSelf = computed(() => {
  const winner = props.confirmedRoundWinner || props.effectiveRoundWinner;
  return winner === props.myId;
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
// Note: winnerAnimating stays true until the celebration overlay appears
// or the round resets — this prevents CSS from hiding or reflowing the card.
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

// Reset winnerAnimating when the celebration overlay appears
// (at that point the overlay covers everything, so we can clean up).
watch(
  () => props.winnerSelected,
  (selected) => {
    if (selected) {
      winnerAnimating.value = false;
    }
  },
);

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
// ── Current player info (for My Score widget) ──────────────────
const currentPlayer = computed(() =>
  props.players.find((p) => p.userId === props.myId),
);

function handleCardSubmit(cardIds: string[]) {
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
  <div ref="tableRef" class="game-table">
    <!-- Player Seats Arc -->
    <div class="seats-arc">
      <div
        v-for="(player, idx) in seatedPlayers"
        :key="player.userId"
        :ref="
          (el) => {
            if (el) seatRefs[player.userId] = el as HTMLElement;
          }
        "
        class="player-seat"
        :class="{
          'player-seat--submitted': hasSubmitted(player.userId),
          'player-seat--judge': player.userId === props.judgeId,
        }"
        :style="getSeatStyle(idx, seatedPlayers.length)"
      >
        <div class="seat-avatar-ring">
          <!-- Score card badge (top-right, appears on hover) -->
          <div class="score-card-badge">
            <span class="score-card-value">{{
              getPlayerScore(player.userId)
            }}</span>
          </div>

          <!-- Judge gavel badge -->
          <div v-if="player.userId === props.judgeId" class="judge-badge">
            <Icon name="mdi:gavel" />
          </div>

          <!-- Submitted checkmark badge -->
          <div v-if="hasSubmitted(player.userId)" class="seat-check">
            <Icon name="solar:check-circle-bold" />
          </div>

          <UAvatar
            :src="player.avatar || undefined"
            :alt="player.name"
            size="xl"
            class="seat-avatar-img"
          />
        </div>
        <span class="seat-name">{{ player.name }}</span>
      </div>
    </div>

    <!-- Overflow Player List (7+) -->
    <div v-if="overflowPlayers.length > 0" class="overflow-list">
      <div
        v-for="player in overflowPlayers"
        :key="player.userId"
        :ref="
          (el) => {
            if (el) seatRefs[player.userId] = el as HTMLElement;
          }
        "
        class="overflow-player"
        :class="{
          'overflow-player--submitted': hasSubmitted(player.userId),
          'overflow-player--judge': player.userId === props.judgeId,
        }"
      >
        <div class="overflow-avatar-wrap">
          <UAvatar
            :src="player.avatar || undefined"
            :alt="player.name"
            size="sm"
          />
          <div class="overflow-score-badge">
            <span>{{ getPlayerScore(player.userId) }}</span>
          </div>
        </div>
        <span class="overflow-name">{{ player.name }}</span>
        <Icon
          v-if="hasSubmitted(player.userId)"
          name="solar:check-circle-bold"
          class="text-green-400 text-sm"
        />
        <Icon
          v-if="player.userId === props.judgeId"
          name="mdi:gavel"
          class="text-amber-400 text-sm"
        />
      </div>
    </div>

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
                :flipped="true"
                :is-winner="false"
                :disable-hover="true"
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
                  :flipped="!isRevealed(sub.playerId)"
                  :is-winner="effectiveRoundWinner === sub.playerId"
                  :disable-hover="!isRevealed(sub.playerId)"
                  back-logo-url="/img/ufp.svg"
                />
              </div>

              <!-- Judging phase UI -->
              <template v-if="showJudgingUI"> </template>
            </div>
          </div>
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

    <!-- Bottom-left status stack (status text + score widget) -->
    <div class="bottom-left-stack">
      <!-- Status indicators (above score widget) -->
      <div v-if="isSubmitting" class="status-indicators">
        <div v-if="isJudge" class="judge-banner">
          <Icon name="mdi:gavel" class="text-amber-400 text-lg" />
          <span>{{ t("game.you_are_judge") }}</span>
        </div>

        <div v-if="!isJudge && submissions[myId]" class="submitted-message">
          <Icon
            name="solar:check-circle-bold"
            class="text-green-400 text-base"
          />
          <span>{{ t("game.you_submitted") }}</span>
        </div>

        <p class="pile-counter">
          {{ submissionCount }} / {{ totalParticipants }}
          <span class="pile-counter-label">{{
            t("game.player_submitted")
          }}</span>
        </p>
      </div>

      <!-- My Score Widget -->
      <div v-if="currentPlayer && isParticipant" class="my-score-widget">
        <div class="my-score-avatar">
          <UAvatar
            :src="currentPlayer.avatar || undefined"
            :alt="currentPlayer.name"
            size="sm"
          />
        </div>
        <div class="my-score-info">
          <span class="my-score-name">{{ currentPlayer.name }}</span>
          <span class="my-score-role">
            <Icon v-if="isJudge" name="mdi:gavel" class="text-amber-400" />
            {{ isJudge ? t("game.role_judge") : t("game.role_player") }}
          </span>
        </div>
        <div class="my-score-value-card">
          <span class="my-score-value">{{ getPlayerScore(myId) }}</span>
        </div>
      </div>
    </div>

    <!-- Play Mode Toggle (fixed, next to My Score) -->
    <button
      v-if="currentPlayer && isParticipant && !isJudge && isSubmitting"
      class="play-mode-toggle"
      :title="t('game.play_mode')"
      @click.stop="cycleMode()"
    >
      <Icon
        :name="
          playMode === 'click'
            ? 'solar:cursor-bold'
            : playMode === 'instant'
              ? 'solar:bolt-bold'
              : 'solar:hand-shake-bold'
        "
        class="play-mode-icon"
      />
      <span class="play-mode-label">{{
        playMode === "click"
          ? t("game.play_mode_click")
          : playMode === "instant"
            ? t("game.play_mode_instant")
            : t("game.play_mode_gesture")
      }}</span>
    </button>

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
          @select-cards="handleCardSubmit"
        />
      </div>
    </Transition>

    <!-- ═══ WINNER CELEBRATION OVERLAY ═══ -->
    <Transition name="celebration">
      <div v-if="winnerSelected" class="winner-overlay">
        <div class="winner-overlay-content">
          <h2 class="winner-headline">
            <template v-if="isWinnerSelf">
              {{ t("game.round_won_self") }}
            </template>
            <template v-else>
              {{ t("game.round_won_other", { name: winnerName }) }}
            </template>
          </h2>

          <!-- Winning cards display -->
          <div
            v-if="winningCards && winningCards.length > 0"
            class="winner-cards-display"
          >
            <div v-if="blackCard" class="winner-prompt">
              <BlackCard
                :card-id="blackCard.id"
                :text="blackCard.text"
                :num-pick="blackCard.pick"
                :flipped="false"
              />
            </div>
            <div class="winner-answers">
              <WhiteCard
                v-for="cardId in winningCards"
                :key="cardId"
                :cardId="cardId"
                :is-winner="true"
                :flipped="false"
                back-logo-url="/img/ufp.svg"
              />
            </div>
          </div>

          <p class="winner-subtitle">
            {{ t("game.next_round_starting_soon") }}
          </p>
          <div class="winner-progress">
            <UProgress indeterminate color="warning" />
          </div>
        </div>
      </div>
    </Transition>
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
}

/* ── Player Seats Arc (docked to top) ──────────────────────── */
.seats-arc {
  position: fixed;
  top: 110px;
  left: 0;
  width: 100%;
  height: 70px;
  z-index: 40;
  pointer-events: none;
}

.player-seat {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  transition: all 0.3s ease;
  cursor: default;
  pointer-events: auto;
}

/* ── Avatar Ring (thick dark border) ──────────────────────── */
.seat-avatar-ring {
  position: relative;
  border-radius: 50%;
  padding: 4px;
  background: linear-gradient(
    135deg,
    rgba(71, 85, 105, 0.6),
    rgba(30, 41, 59, 0.9)
  );
  box-shadow:
    0 0 0 3px rgba(30, 41, 59, 0.95),
    0 4px 16px rgba(0, 0, 0, 0.3);
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.player-seat:hover .seat-avatar-ring {
  box-shadow:
    0 0 0 3px rgba(51, 65, 85, 0.95),
    0 6px 24px rgba(0, 0, 0, 0.4);
  transform: scale(1.05);
}

.seat-avatar-img {
  width: 48px !important;
  height: 48px !important;
  font-size: 1.35rem;
}

/* ── Submitted ring glow ──────────────────────────────────── */
.player-seat--submitted .seat-avatar-ring {
  background: linear-gradient(
    135deg,
    rgba(34, 197, 94, 0.4),
    rgba(22, 163, 74, 0.25)
  );
  box-shadow:
    0 0 0 3px rgba(34, 197, 94, 0.3),
    0 0 20px rgba(34, 197, 94, 0.15),
    0 4px 16px rgba(0, 0, 0, 0.3);
}

/* ── Judge ring glow ──────────────────────────────────────── */
.player-seat--judge .seat-avatar-ring {
  background: linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.35),
    rgba(217, 119, 6, 0.2)
  );
  box-shadow:
    0 0 0 3px rgba(245, 158, 11, 0.25),
    0 0 18px rgba(245, 158, 11, 0.12),
    0 4px 16px rgba(0, 0, 0, 0.3);
}

/* ── Score Card Badge (top-right, mini playing card) ──────── */
.score-card-badge {
  position: absolute;
  top: -6px;
  right: -10px;
  width: 26px;
  height: 34px;
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border: 1.5px solid rgba(100, 116, 139, 0.4);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(12deg) scale(0);
  transform-origin: bottom left;
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  z-index: 10;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.player-seat:hover .score-card-badge {
  transform: rotate(12deg) scale(1);
  opacity: 1;
}

.score-card-value {
  font-family: "Bebas Neue", sans-serif;
  font-size: 0.85rem;
  color: rgba(241, 245, 249, 0.95);
  letter-spacing: 0.02em;
  line-height: 1;
}

/* ── Judge Badge (bottom-left gavel) ──────────────────────── */
.judge-badge {
  position: absolute;
  bottom: -4px;
  left: -6px;
  width: 28px;
  height: 28px;
  background: rgba(245, 158, 11, 0.25);
  border: 2px solid rgba(245, 158, 11, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  color: #f59e0b;
  z-index: 10;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.25);
  animation: check-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* ── Submitted Check Badge (bottom-right) ─────────────────── */
.seat-check {
  position: absolute;
  bottom: -2px;
  right: -4px;
  width: 24px;
  height: 24px;
  background: rgba(15, 23, 42, 0.9);
  border: 2px solid rgba(34, 197, 94, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  color: #22c55e;
  z-index: 10;
  animation: check-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes check-pop {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

.seat-name {
  font-family: "Bebas Neue", sans-serif;
  font-size: 0.7rem;
  color: rgba(148, 163, 184, 0.9);
  letter-spacing: 0.04em;
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  transition: color 0.3s ease;
}

.player-seat--submitted .seat-name {
  color: rgba(34, 197, 94, 0.9);
}

.player-seat--judge .seat-name {
  color: rgba(245, 158, 11, 0.9);
}

/* ── Overflow List ──────────────────────────────────────────── */
.overflow-list {
  position: fixed;
  top: 152px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  z-index: 40;
  background: rgba(30, 41, 59, 0.4);
  border-radius: 0.75rem;
  max-width: 90%;
}

.overflow-player {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  background: rgba(51, 65, 85, 0.5);
  transition: all 0.3s ease;
  cursor: default;
}

.overflow-player:hover {
  background: rgba(51, 65, 85, 0.7);
}

.overflow-player--submitted {
  background: rgba(34, 197, 94, 0.1);
}

.overflow-player--judge {
  background: rgba(245, 158, 11, 0.1);
}

.overflow-avatar-wrap {
  position: relative;
}

.overflow-score-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border: 1.5px solid rgba(100, 116, 139, 0.4);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  transform: rotate(10deg) scale(0);
  opacity: 0;
  transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  pointer-events: none;
  font-family: "Bebas Neue", sans-serif;
  font-size: 0.65rem;
  color: rgba(241, 245, 249, 0.9);
  z-index: 5;
}

.overflow-player:hover .overflow-score-badge {
  transform: rotate(10deg) scale(1);
  opacity: 1;
}

.overflow-name {
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.8);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Bottom-left status stack ────────────────────────────── */
.bottom-left-stack {
  position: fixed;
  bottom: 1.25rem;
  left: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  z-index: 60;
}

.status-indicators {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
}

/* ── My Score Widget (bottom-left) ───────────────────────── */
.my-score-widget {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.5rem 0.75rem;
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.85),
    rgba(15, 23, 42, 0.92)
  );
  border: 1px solid rgba(100, 116, 139, 0.2);
  border-radius: 14px;
  backdrop-filter: blur(12px);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  transition: all 0.3s ease;
}

.my-score-widget:hover {
  border-color: rgba(100, 116, 139, 0.35);
  box-shadow:
    0 6px 28px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transform: translateY(-2px);
}

.my-score-avatar {
  flex-shrink: 0;
}

.my-score-info {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.my-score-name {
  font-family: "Bebas Neue", sans-serif;
  font-size: 0.95rem;
  color: rgba(241, 245, 249, 0.95);
  letter-spacing: 0.03em;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100px;
}

.my-score-role {
  font-family: "Bebas Neue", sans-serif;
  font-size: 0.7rem;
  color: rgba(148, 163, 184, 0.7);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.my-score-value-card {
  width: 38px;
  height: 50px;
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border: 2px solid rgba(100, 116, 139, 0.4);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
  flex-shrink: 0;
  transform: rotate(6deg);
}

.my-score-value {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.3rem;
  color: rgba(241, 245, 249, 0.95);
  letter-spacing: 0.02em;
  line-height: 1;
}

/* ── Play Mode Toggle (fixed, next to My Score) ────────────── */
.play-mode-toggle {
  position: fixed;
  bottom: 1.25rem;
  left: 14rem;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.85rem;
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.85),
    rgba(15, 23, 42, 0.92)
  );
  border: 1px solid rgba(100, 116, 139, 0.2);
  border-radius: 9999px;
  backdrop-filter: blur(12px);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
}

.play-mode-toggle:hover {
  border-color: rgba(100, 116, 139, 0.35);
  box-shadow:
    0 6px 28px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transform: translateY(-1px);
}

.play-mode-icon {
  font-size: 1rem;
  color: rgba(148, 163, 184, 0.9);
}

.play-mode-label {
  font-family: "Bebas Neue", sans-serif;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  color: rgba(148, 163, 184, 0.9);
  text-transform: uppercase;
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

.judge-banner {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.85rem;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 9999px;
  font-family: "Bebas Neue", sans-serif;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  color: rgba(245, 158, 11, 0.9);
  text-transform: uppercase;
}

/* ── Judging Info Bar ────────────────────────────────────────── */
.judging-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.35rem 1rem;
  font-family: "Bebas Neue", sans-serif;
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
  font-family: "Bebas Neue", sans-serif;
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
  font-family: "Bebas Neue", sans-serif;
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
  font-family: "Bebas Neue", sans-serif;
  font-size: 0.8rem;
  color: rgba(34, 197, 94, 0.9);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* ── Submissions Grid (legacy — kept for compatibility) ──────── */

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
  font-family: "Bebas Neue", sans-serif;
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

/* Pile mode: fan combo cards slightly so you can see multiple cards */
.submission-group--pile-mode .submission-cards > *:not(:last-child) {
  margin-right: -6.5rem;
}
.submission-group--pile-mode .submission-cards > *:nth-child(2) {
  transform: rotate(4deg) translateY(3px);
}
.submission-group--pile-mode .submission-cards > *:nth-child(3) {
  transform: rotate(-3deg) translateY(-2px);
}

@media (min-width: 768px) {
  .unified-card--grid
    .submission-group:not(.submission-group--revealed)
    .submission-cards
    > *:not(:last-child) {
    margin-right: -9.5rem;
  }
  .submission-group--pile-mode .submission-cards > *:not(:last-child) {
    margin-right: -9.5rem;
  }

  .judging-grid {
    gap: 1.25rem;
    padding: 0.5rem;
  }

  .grid-cell {
    padding: 0.85rem;
  }
}

/* ── Reveal Hint ─────────────────────────────────────────────── */
.reveal-hint {
  font-family: "Bebas Neue", sans-serif;
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
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.1rem;
  letter-spacing: 0.04em;
  color: white;
  text-align: center;
  width: 100%;
}

.winner-badge {
  font-family: "Bebas Neue", sans-serif;
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

/* ═══ WINNER CELEBRATION OVERLAY ═══ */
.winner-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2, 6, 23, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.winner-overlay-content {
  text-align: center;
  max-width: 700px;
  width: 100%;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.winner-headline {
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(2.5rem, 8vw, 5rem);
  color: #f59e0b;
  letter-spacing: 0.04em;
  text-shadow:
    0 0 30px rgba(245, 158, 11, 0.4),
    0 0 60px rgba(245, 158, 11, 0.2);
  animation: headline-entrance 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes headline-entrance {
  from {
    opacity: 0;
    transform: scale(0.5) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.winner-cards-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

@media (min-width: 640px) {
  .winner-cards-display {
    flex-direction: row;
    justify-content: center;
    gap: 1.5rem;
  }
}

.winner-prompt {
  flex-shrink: 0;
}

.winner-answers {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.winner-subtitle {
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.2rem;
  color: rgba(148, 163, 184, 0.8);
  letter-spacing: 0.06em;
}

.winner-progress {
  width: 200px;
}

/* ── Celebration Transition ──────────────────────────────────── */
.celebration-enter-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.celebration-leave-active {
  transition: all 0.3s ease;
}

.celebration-enter-from {
  opacity: 0;
  backdrop-filter: blur(0);
}

.celebration-enter-from .winner-headline {
  transform: scale(0.5) translateY(20px);
  opacity: 0;
}

.celebration-leave-to {
  opacity: 0;
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
</style>
