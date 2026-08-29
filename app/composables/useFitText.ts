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
  /** Enable a single intentional word break when no whole-word layout fits. */
  onEmergencyBreaks?: () => boolean;
}

// Bounded module-level cache for fitted font sizes to avoid repeated forced layout reflows
const fitTextCache = new Map<string, { size: number; allowRawBreak: boolean }>();
const MAX_CACHE_SIZE = 1000;

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

  // Disallow the raw "break anywhere" fallback while measuring, so a size
  // only "fits" if normal wrapping - plus the real syllable breaks (soft
  // hyphens from hyphenateCardText, capped at one per word) - is enough
  // on its own. We deliberately never touch `hyphens` here: leaving it at
  // its default (manual) means the search and the final render always
  // agree on where the legitimate break points are.
  function fits(size: number): boolean {
    const containerEl = container.value;
    const textEl = text.value;
    if (!containerEl || !textEl) return true;
    textEl.style.fontSize = `${size}px`;
    textEl.style.overflowWrap = "normal";
    textEl.style.wordBreak = "normal";
    return (
      textEl.scrollHeight <= containerEl.clientHeight + 0.5 &&
      textEl.scrollWidth <= containerEl.clientWidth + 0.5
    );
  }

  // `allowRawBreak` restores `overflow-wrap: break-word` as a last-resort
  // fallback only for the one case that actually needs it: a word whose
  // single hyphenation point still isn't enough to fit at the minimum
  // size. For every size the search itself found (the common case),
  // fitting was already confirmed under these exact overflow-wrap:normal
  // conditions, so leaving it at normal for the final render too avoids a
  // browser quirk where re-enabling break-word can grab one extra
  // character past the hyphen just to fill the line a little fuller.
  function settle(size: number, allowRawBreak: boolean) {
    const textEl = text.value;
    if (!textEl) return;
    fontSize.value = size;
    textEl.style.fontSize = `${size}px`;
    textEl.style.overflowWrap = allowRawBreak ? "break-word" : "normal";
    textEl.style.removeProperty("word-break");
  }

  function recalc() {
    const containerEl = container.value;
    const textEl = text.value;
    if (!containerEl || !textEl || !containerEl.clientWidth) return;

    const widthRounded = Math.round(containerEl.clientWidth);
    const heightRounded = Math.round(containerEl.clientHeight);
    const cacheKey = `${content.value}::${widthRounded}x${heightRounded}::${minRatio}:${maxRatio}:${minRem}:${maxRem}`;

    const cached = fitTextCache.get(cacheKey);
    if (cached) {
      settle(cached.size, cached.allowRawBreak);
      return;
    }

    const lo0 = Math.max(containerEl.clientWidth * minRatio, remToPx(minRem));
    const hi0 = Math.max(lo0, Math.min(containerEl.clientWidth * maxRatio, remToPx(maxRem)));

    if (!fits(lo0)) {
      if (options.onEmergencyBreaks?.()) {
        scheduleRecalc();
        return;
      }
      if (fitTextCache.size >= MAX_CACHE_SIZE) {
        const firstKey = fitTextCache.keys().next().value;
        if (firstKey) fitTextCache.delete(firstKey);
      }
      fitTextCache.set(cacheKey, { size: lo0, allowRawBreak: true });
      settle(lo0, true);
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

    if (fitTextCache.size >= MAX_CACHE_SIZE) {
      const firstKey = fitTextCache.keys().next().value;
      if (firstKey) fitTextCache.delete(firstKey);
    }
    fitTextCache.set(cacheKey, { size: lo, allowRawBreak: false });
    settle(lo, false);
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

  onMounted(() => {
    scheduleRecalc();
    // The custom card font can still be loading on first mount (font-display:
    // swap renders a fallback font meanwhile). A fallback is usually narrower
    // than the real face, so a size measured against it can turn out too big
    // once the real font swaps in — re-measure once web fonts are ready.
    document.fonts?.ready?.then(scheduleRecalc);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
  });

  return { fontSize, recalc };
}
