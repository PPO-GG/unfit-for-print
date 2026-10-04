import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { effectScope, nextTick, type EffectScope } from "vue";
import { useCompactLayout } from "~/composables/useCompactLayout";
import { COMPACT_MEDIA_QUERY } from "~/utils/compactViewport";

type Listener = (event: { matches: boolean }) => void;
interface Registered {
  query: string;
  cb: Listener;
}

const original = window.matchMedia;
let viewport = { width: 1280, height: 800 };
let listeners: Registered[] = [];
let scope: EffectScope;

function evaluate(query: string): boolean {
  const { width, height } = viewport;
  if (query === COMPACT_MEDIA_QUERY) return width < 768 || height < 500;
  if (query === "(orientation: landscape)") return width > height;
  return false;
}

/** jsdom has no matchMedia: answer the two queries from `viewport`. */
function stubMatchMedia() {
  window.matchMedia = ((query: string) => {
    const add = (_: string | Listener, cb?: Listener) =>
      listeners.push({ query, cb: (cb ?? _) as Listener });
    const remove = (_: string | Listener, cb?: Listener) => {
      const fn = cb ?? _;
      listeners = listeners.filter((l) => l.cb !== fn);
    };
    return {
      get matches() {
        return evaluate(query);
      },
      media: query,
      addEventListener: add,
      removeEventListener: remove,
      addListener: add,
      removeListener: remove,
    };
  }) as unknown as typeof window.matchMedia;
}

function resizeTo(width: number, height: number) {
  viewport = { width, height };
  listeners
    .slice()
    .forEach(({ query, cb }) => cb({ matches: evaluate(query) }));
}

describe("useCompactLayout", () => {
  beforeEach(() => {
    viewport = { width: 1280, height: 800 };
    listeners = [];
    stubMatchMedia();
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    window.matchMedia = original;
  });

  it("follows the media queries across a rotation", async () => {
    resizeTo(375, 812);
    const { isCompact, orientation } = scope.run(() => useCompactLayout())!;
    expect(isCompact.value).toBe(true);
    expect(orientation.value).toBe("portrait");

    resizeTo(844, 390);
    await nextTick();
    expect(isCompact.value).toBe(true);
    expect(orientation.value).toBe("landscape");

    resizeTo(1280, 800);
    await nextTick();
    expect(isCompact.value).toBe(false);
    expect(orientation.value).toBe("landscape");
  });

  it("ignores innerWidth/innerHeight, which a keyboard or zoom can change", async () => {
    resizeTo(1280, 800);
    const { isCompact } = scope.run(() => useCompactLayout())!;
    Object.defineProperty(window, "innerHeight", { value: 300, configurable: true });
    window.dispatchEvent(new Event("resize"));
    await nextTick();
    expect(isCompact.value).toBe(false);
  });

  it("returns the window size for geometry", () => {
    const layout = scope.run(() => useCompactLayout())!;
    expect(typeof layout.width.value).toBe("number");
    expect(typeof layout.height.value).toBe("number");
  });
});
