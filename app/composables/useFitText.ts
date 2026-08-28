/**
 * Auto-sizes a text element to fill its container: grows the font size
 * toward a cap when there's room to spare, and shrinks it just enough
 * that the full string wraps within the container without being cut
 * off. Re-measures whenever the text or the container's size changes.
 *
 * Bounds are expressed as a fraction of the container's own width (so
 * they scale naturally with things like the card `scale` prop) plus an
 * absolute rem ceiling/floor so short strings don't blow up past a
 * sane size on very large containers.
 */
import {
  onBeforeUnmount,
  onMounted,
  nextTick,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from "vue";

export interface FitTextOptions {
  /** Min/max font size as a fraction of the container's clientWidth. */
  minRatio?: number;
  maxRatio?: number;
  /** Absolute min/max font size in rem, regardless of container size. */
  minRem?: number;
  maxRem?: number;
}

export function useFitText(
  container: Ref<HTMLElement | null>,
  text: Ref<HTMLElement | null>,
  content: Ref<string> | ComputedRef<string>,
  options: FitTextOptions = {},
) {
  const minRatio = options.minRatio ?? 0.035;
  const maxRatio = options.maxRatio ?? 0.42;
  const minRem = options.minRem ?? 0.45;
  const maxRem = options.maxRem ?? 2.6;

  const fontSize = ref(0);
  let observer: ResizeObserver | null = null;
  let queued = false;

  function remToPx(rem: number): number {
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  // While measuring, force whole-word wrapping (no mid-word breaks, no
  // hyphenation) so a font size only "fits" if every word wraps cleanly
  // at that size. The CSS class's own `hyphens: auto` (with `overflow-wrap:
  // break-word` as an ultimate fallback) stays in place for the rare word
  // that's still too long to keep whole even at the minimum size — so the
  // one break that does happen lands at a real syllable, not "characterist-ic".
  function fits(size: number): boolean {
    const containerEl = container.value;
    const textEl = text.value;
    if (!containerEl || !textEl) return true;
    textEl.style.fontSize = `${size}px`;
    textEl.style.overflowWrap = "normal";
    textEl.style.wordBreak = "normal";
    textEl.style.hyphens = "none";
    return (
      textEl.scrollHeight <= containerEl.clientHeight + 0.5 &&
      textEl.scrollWidth <= containerEl.clientWidth + 0.5
    );
  }

  function settle(size: number) {
    const textEl = text.value;
    if (!textEl) return;
    fontSize.value = size;
    textEl.style.fontSize = `${size}px`;
    // Hand width control back to the stylesheet's hyphenate/break-word fallback.
    textEl.style.removeProperty("overflow-wrap");
    textEl.style.removeProperty("word-break");
    textEl.style.removeProperty("hyphens");
  }

  function recalc() {
    const containerEl = container.value;
    const textEl = text.value;
    if (!containerEl || !textEl || !containerEl.clientWidth) return;

    const lo0 = Math.max(containerEl.clientWidth * minRatio, remToPx(minRem));
    const hi0 = Math.max(lo0, Math.min(containerEl.clientWidth * maxRatio, remToPx(maxRem)));

    if (!fits(lo0)) {
      settle(lo0);
      return;
    }

    let lo = lo0;
    let hi = hi0;
    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    settle(lo);
  }

  // Debounced via a microtask (nextTick) rather than requestAnimationFrame:
  // rAF is paused on hidden/backgrounded tabs, which would leave cards
  // stuck at their default size until the tab regains focus.
  function scheduleRecalc() {
    if (queued) return;
    queued = true;
    nextTick(() => {
      queued = false;
      recalc();
    });
  }

  watch(content, scheduleRecalc);

  watch(
    container,
    (el, _old, onCleanup) => {
      observer?.disconnect();
      if (el) {
        observer = new ResizeObserver(() => scheduleRecalc());
        observer.observe(el);
      }
      onCleanup(() => observer?.disconnect());
    },
    { immediate: true },
  );

  onMounted(scheduleRecalc);

  onBeforeUnmount(() => {
    observer?.disconnect();
  });

  return { fontSize, recalc };
}
