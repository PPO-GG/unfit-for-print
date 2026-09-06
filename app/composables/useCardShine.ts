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
 */
import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

export interface CardRotation {
  x: number;
  y: number;
}

/** Fraction of the remaining distance covered each frame. */
const EASE = 0.05;

export function useCardShine(
  rotation: Ref<CardRotation>,
  enabled: () => boolean = () => true,
) {
  const shineOffset = ref<CardRotation>({ x: 0, y: 0 });
  let frame: number | null = null;

  function step() {
    shineOffset.value.x += (rotation.value.x - shineOffset.value.x) * EASE;
    shineOffset.value.y += (rotation.value.y - shineOffset.value.y) * EASE;
    frame = requestAnimationFrame(step);
  }

  function start() {
    if (frame !== null || !enabled()) return;
    frame = requestAnimationFrame(step);
  }

  function stop() {
    if (frame === null) return;
    cancelAnimationFrame(frame);
    frame = null;
  }

  onMounted(start);
  onBeforeUnmount(stop);

  return { shineOffset, start, stop };
}
