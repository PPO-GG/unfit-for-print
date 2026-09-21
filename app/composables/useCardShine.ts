/**
 * Drives the holographic shine's easing on WhiteCard/BlackCard: a per-frame
 * chase of the card's current hover rotation.
 *
 * Extracted from both card components, which each ran an identical
 * self-perpetuating requestAnimationFrame loop started on mount and never
 * cancelled. An unmounted card kept its loop alive for the life of the page,
 * writing to a reactive ref every frame and re-triggering the dependent shine
 * style. That is invisible for one card but compounds badly anywhere cards are
 * re-mounted in bulk — the Labs pack browser re-mounts 24 of them on every card
 * type toggle and page change, so browsing steadily degraded the whole tab.
 *
 * Owning the handle here means the loop stops with the component.
 *
 * The loop also stops when it has nothing left to do. The ease is asymptotic,
 * so a *mounted* card never reached its target and kept writing to a
 * deep-reactive ref every frame whether or not anyone was hovering it — a full
 * hand at a high refresh rate burned thousands of reactive writes a second to
 * animate a difference too small to see. `SETTLED` ends the chase; a watcher on
 * the rotation restarts it on the next hover.
 */
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";

export interface CardRotation {
  x: number;
  y: number;
}

/** Fraction of the remaining distance covered each frame. */
const EASE = 0.05;

/**
 * Degrees of remaining travel below which the chase is finished. Rotations are
 * whole degrees within the card's tilt range, so this is far under one frame of
 * visible movement.
 */
const SETTLED = 0.01;

export function useCardShine(
  rotation: Ref<CardRotation>,
  enabled: () => boolean = () => true,
) {
  const shineOffset = ref<CardRotation>({ x: 0, y: 0 });
  let frame: number | null = null;
  let active = true;

  function step() {
    const dx = rotation.value.x - shineOffset.value.x;
    const dy = rotation.value.y - shineOffset.value.y;

    if (Math.abs(dx) < SETTLED && Math.abs(dy) < SETTLED) {
      // Snap, so the resting value is exact and further writes are no-ops.
      shineOffset.value.x = rotation.value.x;
      shineOffset.value.y = rotation.value.y;
      frame = null;
      return;
    }

    shineOffset.value.x += dx * EASE;
    shineOffset.value.y += dy * EASE;
    frame = requestAnimationFrame(step);
  }

  function start() {
    if (frame !== null || !active || !enabled()) return;
    frame = requestAnimationFrame(step);
  }

  function stop() {
    if (frame === null) return;
    cancelAnimationFrame(frame);
    frame = null;
  }

  // Sync flush: the loop has to resume on the pointer event itself, not a tick
  // later, or the first frame of a hover is dropped.
  watch(rotation, start, { deep: true, flush: "sync" });

  onMounted(start);
  onBeforeUnmount(() => {
    // Latched before stop() so a rotation write racing the teardown cannot
    // restart the loop the unmount just cancelled.
    active = false;
    stop();
  });

  return { shineOffset, start, stop };
}
