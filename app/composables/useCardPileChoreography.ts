/**
 * Card-pile choreography for the submission phase of GameTable.
 *
 * Owns everything about getting a played card from a player's hand (or from
 * another player's pill in the header) into the scattered pile in the middle
 * of the table:
 *
 *  - the per-player scatter angle that makes the pile look messy but stays
 *    stable within a round,
 *  - the "ghost" clones that actually fly across the screen (they live on
 *    `document.body`, outside Vue's control, so reactivity can't kill them
 *    mid-flight),
 *  - the reconciliation between an *optimistic* local ghost (fired the instant
 *    the player clicks) and the *real* pile card that appears later when the
 *    Y.Doc submission syncs back.
 *
 * That last part is the fiddly bit and the reason this is one composable
 * rather than three: the optimistic path and the Y.Doc-watcher path write to
 * the same four tracking sets, and the ordering between them is what keeps a
 * card from either flashing at its destination early or leaving a ghost stuck
 * on screen forever.
 *
 * Round boundaries are driven by the caller via `resetForNewRound()`, which
 * GameTable fires when `promptSerial` changes — a new prompt on the table,
 * whether from a normal round advance or a judge skipping the black card.
 * It is deliberately NOT driven by `submissions` emptying, which happens
 * transiently while realtime state re-parses and would make every card
 * re-animate. Legacy docs with no serial fall back to the judging → submitting
 * phase edge.
 */
import { ref, onBeforeUnmount, watch, nextTick, type Ref } from "vue";
import { gsap } from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useSfx } from "~/composables/useSfx";
import { useCardFlyCoords } from "~/composables/useCardFlyCoords";
import { SFX, SPRITES } from "~/config/sfx.config";

export interface CardAngle {
  rotate: number;
  tx: number;
  ty: number;
}

export interface CardPileChoreographyOptions {
  /** Current submissions map (player id → card ids). */
  submissions: () => Record<string, string[]>;
  /** The local player's id, used to distinguish local from remote fly-ins. */
  myId: () => string;
  /** True while the table is in the submitting phase. */
  isSubmitting: () => boolean;
  /** The pile container element; fly-in destinations are measured from it. */
  cardContainerRef: Ref<HTMLElement | null>;
  /** Off-screen WhiteCard used as the clone source for optimistic ghosts. */
  ghostTemplateRef: Ref<HTMLElement | null>;
}

export function useCardPileChoreography(
  options: CardPileChoreographyOptions,
) {
  const { submissions, myId, isSubmitting, cardContainerRef, ghostTemplateRef } =
    options;

  // Registered here rather than at module scope so importing this composable
  // stays side-effect free: GameTable is stubbed in several component tests,
  // whose partial `gsap` mocks have no registerPlugin to call.
  gsap.registerPlugin(MotionPathPlugin);

  const { consumeCentroid } = useCardFlyCoords();

  // Sprite-based SFX for card landing sounds
  const { playSfx: playCardLandSfx } = useSfx(
    SPRITES.cardLand.src,
    SPRITES.cardLand.map,
  );
  // General SFX (individual files)
  const { playSfx } = useSfx();

  // Track random angles for thrown cards (stable per player).
  // Plain object (non-reactive) so that caching a new card's angle
  // doesn't trigger Vue re-renders on every existing pile card.
  let cardAngles: Record<string, CardAngle> = {};

  // Track previous submissions for fly-in animations
  const prevSubmissionKeys = ref<Set<string>>(new Set());

  // Guard: track which player IDs have already been animated this round
  // to prevent duplicate fly-ins when the deep watcher fires multiple times.
  const animatedPids = new Set<string>();
  // Track pids with in-flight ghost animations (real card stays hidden)
  const flyingGhosts = ref<Set<string>>(new Set());
  // Optimistic ghosts that must persist until the real pile card arrives
  const pendingOptimisticGhosts = new Map<string, HTMLElement>();
  // Pids whose submission arrived (Y.Doc sync) BEFORE the GSAP animation finished.
  // The GSAP onComplete checks this set to self-clean instead of storing a persistent ghost.
  const earlyArrivalPids = new Set<string>();

  //* ── Random card scatter for natural pile feel ────────────────────
  // Each card gets a fully random rotation, direction, and distance
  // from center, producing a messy, organic pile that looks different
  // every round. Cached per player so angles stay stable within a round.
  function getCardAngle(playerId: string): CardAngle {
    let angle = cardAngles[playerId];
    if (!angle) {
      // Fully random rotation between -25° and +25°
      const rotate = (Math.random() - 0.5) * 50;

      // Random direction (any angle around the center)
      const theta = Math.random() * Math.PI * 2;

      // Random distance from center (15–60px)
      const radius = 15 + Math.random() * 45;

      angle = {
        rotate,
        tx: Math.cos(theta) * radius,
        ty: Math.sin(theta) * radius,
      };
      cardAngles[playerId] = angle;
    }
    return angle;
  }

  /**
   * Read a player's cached scatter angle WITHOUT creating one.
   * The judging FLIP needs the rotation a pile card was resting at so the
   * card appears to un-rotate as it flies into its grid cell; it must not
   * mint a fresh angle for a player who never had a pile card.
   */
  function peekCardAngle(playerId: string): CardAngle | undefined {
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

  // Vue-controlled pile card positioning. Returns the inline style for
  // each pile card so Vue maintains positions through re-renders.
  function getPileCardStyle(pid: string): Record<string, string | number> {
    // Hide real card while ghost is flying
    if (flyingGhosts.value.has(pid)) return { opacity: 0 };
    const angle = cardAngles[pid];
    if (!angle) return { opacity: 0 }; // not yet positioned
    return {
      transform: `translate(${angle.tx}px, ${angle.ty}px) rotate(${angle.rotate}deg)`,
      opacity: 1,
    };
  }

  /**
   * Clear every trace of the previous round's animations.
   * Called by the caller's phase watcher on the judging → submitting edge.
   */
  function resetForNewRound() {
    animatedPids.clear();
    flyingGhosts.value.clear();
    // Clean up any lingering optimistic ghosts
    for (const ghost of pendingOptimisticGhosts.values()) ghost.remove();
    pendingOptimisticGhosts.clear();
    earlyArrivalPids.clear();
    cardAngles = {};
    prevSubmissionKeys.value = new Set();

    // Remove ALL leaked ghost DOM elements (safety net for unmount/remount races)
    document.querySelectorAll<HTMLElement>("[data-unfit-ghost]").forEach((el) => {
      gsap.killTweensOf(el);
      el.remove();
    });
  }

  /**
   * Adopt submissions that already exist when the table mounts (hot reload,
   * late join, page refresh) so they render in the pile without replaying
   * their fly-in animations.
   */
  function adoptExistingSubmissions(positionInPile: boolean) {
    const existingKeys = Object.keys(submissions());
    prevSubmissionKeys.value = new Set(existingKeys);
    existingKeys.forEach((pid) => animatedPids.add(pid));

    // Vue's :style binding via getPileCardStyle() handles the actual positioning
    if (positionInPile) existingKeys.forEach((pid) => getCardAngle(pid));
  }

  /**
   * Clone a card into a free-floating ghost on document.body.
   *
   * The ghost lives outside Vue's control so reactivity cannot kill it
   * mid-flight. All classes are stripped because .unified-card--pile carries
   * inset/margin/opacity/position rules that fight absolute placement, and
   * position:fixed with left:0;top:0 means GSAP x/y are screen coordinates
   * directly.
   */
  function createGhost(
    el: HTMLElement,
    cardWidth: number,
    cardHeight: number,
  ): HTMLElement {
    const ghost = el.cloneNode(true) as HTMLElement;
    // Strip ALL classes to remove conflicting .unified-card--pile rules
    // (inset: 0, margin: auto, opacity: 0, position: absolute)
    ghost.className = "";
    ghost.dataset.unfitGhost = "true";
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
    return ghost;
  }

  // ── Fly-in animation for submissions arriving over the wire ─────
  watch(
    submissions,
    async (newSubs) => {
      const newKeys = new Set(Object.keys(newSubs));
      const addedKeys: string[] = [];
      for (const key of newKeys) {
        const isNewlyAdded =
          !prevSubmissionKeys.value.has(key) && !animatedPids.has(key);
        if (isNewlyAdded) {
          flyingGhosts.value.add(key); // hide real card BEFORE angle is set
          getCardAngle(key);
          addedKeys.push(key);
          animatedPids.add(key);
        }

        // Its own fly-in animation hasn't started yet (that happens below,
        // after nextTick), so there's no ghost to reconcile against yet.
        // Checking here would immediately see the flyingGhosts flag we just
        // set above and wrongly treat it as an "early arrival", un-hiding
        // the real pile card before the ghost even starts flying.
        if (isNewlyAdded) continue;

        // Clean up optimistic ghost now that the real pile card exists.
        // Only the GSAP onComplete handlers may clear flyingGhosts — doing
        // it here would reveal the real card before its fly-in finishes.
        const ghost = pendingOptimisticGhosts.get(key);
        if (ghost) {
          if (flyingGhosts.value.has(key)) {
            // Animation still in progress — let GSAP onComplete handle wrapper
            // removal so the fly-in animation finishes visually.
            earlyArrivalPids.add(key);
          } else {
            // Animation already finished — safe to remove immediately
            ghost.remove();
            pendingOptimisticGhosts.delete(key);
          }
        } else if (animatedPids.has(key) && flyingGhosts.value.has(key)) {
          // Submission arrived before GSAP animation completed — mark for
          // self-cleanup in onComplete so the ghost doesn't persist forever.
          earlyArrivalPids.add(key);
        }
      }

      prevSubmissionKeys.value = newKeys;

      // NOTE: Round-reset is handled by the caller's phase watcher via
      // resetForNewRound(). Do NOT clear animatedPids here when
      // newKeys.size === 0, because transient empty states from realtime
      // re-parsing would cause every subsequent submission to re-animate
      // all cards.

      if (addedKeys.length === 0 || !isSubmitting()) return;

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
        const isLocal = pid === myId();

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
          const pillEl = document.querySelector(
            `[data-player-pill="${pid}"]`,
          ) as HTMLElement;
          if (pillEl) {
            const pillRect = pillEl.getBoundingClientRect();
            fromX = pillRect.left + pillRect.width / 2;
            fromY = pillRect.top + pillRect.height / 2;
          } else {
            fromX = destX + (Math.random() - 0.5) * 200;
            fromY = -200;
          }
        }

        // ── Step 3: Mark as flying, create a ghost clone ───────────────
        // The ghost lives outside Vue's control so reactivity can't kill it.
        // Mark in reactive set so Vue hides the real card via :style binding.
        flyingGhosts.value.add(pid);
        const ghost = createGhost(el, cardWidth, cardHeight);

        // Physics-based spin
        const spinDirection = Math.random() > 0.5 ? 1 : -1;
        const startRotation =
          finalAngle.rotate +
          spinDirection *
            (isLocal ? 60 + Math.random() * 60 : 360 + Math.random() * 180);

        // ── Step 4: Animate the ghost from source → destination ────────
        // Ghost uses position:fixed with left:0;top:0, so GSAP x/y are
        // screen coordinates directly.
        const startX = fromX - cardWidth / 2;
        const startY = fromY - cardHeight / 2;
        const endX = destX - cardWidth / 2;
        const endY = destY - cardHeight / 2;

        // Control point: midpoint horizontally, lifted vertically for arc
        const cpX = (startX + endX) / 2;
        const cpY = Math.min(startY, endY) - 120 - Math.random() * 80;

        gsap.set(ghost, {
          x: startX,
          y: startY,
          rotation: startRotation,
          scale: isLocal ? 1.05 : 0.15,
        });

        const tl = gsap.timeline({
          delay: animIndex * 0.2,
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
        });

        // Arc flight
        tl.to(ghost, {
          motionPath: {
            path: [
              { x: startX, y: startY },
              { x: cpX, y: cpY },
              { x: endX, y: endY },
            ],
            type: "quadratic",
          },
          rotation: finalAngle.rotate,
          scale: 1,
          duration: isLocal ? 0.6 : 0.8,
          ease: "power2.inOut",
        });

        // Landing bounce (slight overshoot settle)
        tl.to(ghost, {
          y: endY - 6,
          scale: 1.03,
          duration: 0.08,
          ease: "power1.out",
        });
        tl.to(ghost, {
          y: endY,
          scale: 1,
          duration: 0.12,
          ease: "power2.in",
        });
      });
    },
    { deep: true },
  );

  /**
   * Fire the optimistic local fly-in the instant the player clicks, before
   * the server round-trip. The submissions watcher above skips this pid
   * because `animatedPids` already contains it, preventing a duplicate.
   */
  function flyOptimisticSubmission(cardIds: string[]) {
    const pid = myId();
    const cardCount = cardIds.length;

    animatedPids.add(pid);
    getCardAngle(pid);
    flyingGhosts.value.add(pid);

    // Source: centroid snapshot set by UserHand.snapshotCards() just before emit
    const centroid = consumeCentroid();
    const fromX = centroid?.x ?? window.innerWidth / 2;
    const fromY = centroid?.y ?? window.innerHeight + 200;

    // Destination: center of the pile area
    const pileEl = cardContainerRef.value;
    let destX = window.innerWidth / 2;
    let destY = window.innerHeight / 3;
    if (pileEl) {
      const pileRect = pileEl.getBoundingClientRect();
      destX = pileRect.left + pileRect.width / 2;
      destY = pileRect.top + pileRect.height / 2;
    }

    // Measure card dimensions from the hidden template
    const tpl = ghostTemplateRef.value?.querySelector<HTMLElement>(".card-scaler");
    let cardWidth: number;
    let cardHeight: number;

    const tplRect = tpl?.getBoundingClientRect();
    if (tplRect && tplRect.width > 0 && tplRect.height > 0) {
      cardWidth = tplRect.width;
      cardHeight = tplRect.height;
    } else {
      const vw12 = window.innerWidth * 0.12;
      cardWidth = Math.max(96, Math.min(288, vw12));
      cardHeight = cardWidth * (4 / 3);
    }

    const finalAngle = getCardAngle(pid);

    // Create wrapper for ghost elements — registered immediately so the
    // submissions watcher can find and clean it up if the Y.Doc update
    // arrives before the GSAP animation finishes.
    const ghostWrapper = document.createElement("div");
    ghostWrapper.dataset.unfitGhost = "true";
    ghostWrapper.style.cssText =
      "position:fixed;top:0;left:0;pointer-events:none;z-index:9998;";
    document.body.appendChild(ghostWrapper);
    pendingOptimisticGhosts.set(pid, ghostWrapper);

    // Create one ghost per card for multi-pick visual feedback
    for (let i = 0; i < cardCount; i++) {
      let ghost: HTMLElement;
      if (tpl) {
        ghost = tpl.cloneNode(true) as HTMLElement;
        // Retain container classes (card-scaler) so container queries (cqi)
        // evaluate against card dimensions rather than the full viewport.
        ghost.className = tpl.className;
        ghost.style.position = "fixed";
        ghost.style.left = "0";
        ghost.style.top = "0";
        ghost.style.width = `${cardWidth}px`;
        ghost.style.height = `${cardHeight}px`;
        ghost.style.pointerEvents = "none";
        ghost.style.zIndex = `${9999 - i}`;
        ghost.style.opacity = "1";
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
      ghostWrapper.appendChild(ghost);

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
            // Only the last ghost manages lifecycle.
            if (i !== cardCount - 1) return;

            playCardLandSfx("", {
              volume: [0.7, 0.9],
              pitch: [0.9, 1.1],
            });

            // Reveal the real pile card now that the fly-in has actually
            // finished (not before — that's what caused the real card to
            // flash into view at its final spot while the ghost was
            // still mid-flight).
            flyingGhosts.value.delete(pid);

            if (earlyArrivalPids.has(pid)) {
              // Y.Doc submission arrived before animation finished —
              // remove the wrapper now that the animation is done.
              earlyArrivalPids.delete(pid);
              ghostWrapper.remove();
              pendingOptimisticGhosts.delete(pid);
            }
            // else: animation finished before Y.Doc data arrived —
            // wrapper stays for the submissions watcher to clean up
            // once the real data lands.
          },
        },
      );
    }
  }

  /**
   * Where a returning card should land, mirroring the fly-in's origin lookup
   * (the `isLocal` / pill branch in the submissions watcher above) in reverse.
   *
   * Remote players have a seat pill in the DOM; the local player's hand sits
   * off the bottom of the viewport, which is the same fallback the fly-in uses
   * when it has no centroid snapshot to work from.
   */
  function resolveHomeTarget(
    pid: string,
    rect: DOMRect,
  ): { x: number; y: number } {
    if (pid === myId()) {
      return { x: rect.left + rect.width / 2, y: window.innerHeight + 200 };
    }
    const pillEl = document.querySelector(
      `[data-player-pill="${pid}"]`,
    ) as HTMLElement | null;
    if (pillEl) {
      const r = pillEl.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return { x: rect.left + rect.width / 2, y: -200 };
  }

  /**
   * Sends the pile's cards back to their owners' hands after a judge skips the
   * prompt. A sibling of the fly-in rather than a reversal of it: the fly-in's
   * timeline is discarded on completion (onComplete removes the ghost), and its
   * stored endpoints are stale by the time a skip happens.
   *
   * MUST be called before the Y.Doc write clears `submissions`, or the pile
   * cards unmount before their positions can be captured.
   *
   * The ghosts are tagged `data-unfit-ghost-return` rather than
   * `data-unfit-ghost` ON PURPOSE. A skip bumps `promptSerial` in the same tick
   * as the Y.Doc write, and GameTable's serial watcher answers that by calling
   * `resetForNewRound()`, whose `[data-unfit-ghost]` sweep would kill these
   * tweens before a single frame rendered. The unmount cleanup below still
   * collects them, so they cannot leak.
   */
  function flyPileCardsHome(pids: string[]) {
    const container = cardContainerRef.value;
    if (!container) return;

    pids.forEach((pid, i) => {
      const el = container.querySelector<HTMLElement>(
        `[data-pile-pid="${pid}"]`,
      );
      if (!el) return;

      // Pile cards carry a scatter rotation, so their bounding rect is wider
      // than the card itself. Size the ghost from the layout box (as the fly-in
      // does) and derive endpoints from the rect's centre.
      const rect = el.getBoundingClientRect();
      const cardWidth = el.offsetWidth;
      const cardHeight = el.offsetHeight;

      const ghost = createGhost(el, cardWidth, cardHeight);
      delete ghost.dataset.unfitGhost;
      ghost.dataset.unfitGhostReturn = "true";

      const startX = rect.left + rect.width / 2 - cardWidth / 2;
      const startY = rect.top + rect.height / 2 - cardHeight / 2;
      const home = resolveHomeTarget(pid, rect);
      const endX = home.x - cardWidth / 2;
      const endY = home.y - cardHeight / 2;
      // Same arc shape as the fly-in, lifted between the two endpoints.
      const cpX = (startX + endX) / 2;
      const cpY = Math.min(startY, endY) - 140;

      // Start at the angle the card was resting at so takeoff doesn't snap.
      const startRotation = peekCardAngle(pid)?.rotate ?? 0;

      gsap
        .timeline({ delay: i * 0.06, onComplete: () => ghost.remove() })
        .set(ghost, { x: startX, y: startY, rotation: startRotation, scale: 1 })
        // Takeoff: a small lift instead of the fly-in's landing bounce, which
        // reads wrong at the start of a flight.
        .to(ghost, { scale: 1.06, duration: 0.1, ease: "power1.out" })
        .to(ghost, {
          motionPath: {
            path: [
              { x: startX, y: startY },
              { x: cpX, y: cpY },
              { x: endX, y: endY },
            ],
            type: "quadratic",
          },
          rotation: 0,
          scale: 0.15,
          opacity: 0,
          duration: 0.55,
          ease: "power2.inOut",
        });
    });
  }

  // ── Unmount cleanup: remove leaked ghost DOM elements + kill GSAP tweens ──
  // If GameTable unmounts mid-animation (e.g., reactive state flicker during
  // a transient Teleportal reconnect), ghost clones on document.body would
  // otherwise persist indefinitely — the "cards stuck on screen" bug.
  onBeforeUnmount(() => {
    // 1. Kill tweens AND remove ALL tagged ghost elements from document.body.
    //    An earlier version only killed tweens without removing the elements,
    //    leaving orphan ghosts visible on screen after Teleportal reconnects.
    //    Homeward ghosts are included here — they carry their own attribute so
    //    the round reset leaves them alone, but nothing may survive unmount.
    document
      .querySelectorAll<HTMLElement>(
        "[data-unfit-ghost], [data-unfit-ghost-return]",
      )
      .forEach((el) => {
        gsap.killTweensOf(el);
        el.remove();
      });

    // 2. Remove any pendingOptimisticGhosts not caught by the selector
    for (const wrapper of pendingOptimisticGhosts.values()) {
      gsap.killTweensOf(wrapper);
      wrapper.remove();
    }
    pendingOptimisticGhosts.clear();

    // 3. Clear reactive tracking state
    flyingGhosts.value.clear();
    animatedPids.clear();
    earlyArrivalPids.clear();
  });

  return {
    getCardAngle,
    peekCardAngle,
    getPileCardStyle,
    flyOptimisticSubmission,
    flyPileCardsHome,
    adoptExistingSubmissions,
    resetForNewRound,
  };
}
