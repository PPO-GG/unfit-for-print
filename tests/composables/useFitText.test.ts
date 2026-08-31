import { describe, it, expect, vi, afterEach } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useFitText } from "~/composables/useFitText";

class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error jsdom has no ResizeObserver
globalThis.ResizeObserver ??= StubResizeObserver;

// jsdom doesn't lay out text, so scrollWidth/scrollHeight are always 0.
// Stub them so `fits()` behaves like a real font that only fits once the
// font size drops below a size-dependent threshold. Before fonts finish
// loading we simulate a *wider* (fallback) font than after — this is the
// scenario useFitText's "re-measure once fonts are ready" comment is
// guarding against.
function stubMeasurements(el: HTMLElement, fontsReady: () => boolean) {
  Object.defineProperty(el, "scrollWidth", {
    configurable: true,
    get() {
      const size = parseFloat(el.style.fontSize) || 0;
      const widthPerPx = fontsReady() ? 8 : 12; // fallback font is "wider"
      return size * widthPerPx;
    },
  });
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get() {
      return parseFloat(el.style.fontSize) || 0;
    },
  });
}

function makeFontsController() {
  let resolveReady: () => void;
  let ready = false;
  const promise = new Promise<void>((resolve) => {
    resolveReady = () => {
      ready = true;
      resolve();
    };
  });
  return {
    isReady: () => ready,
    finishLoading: () => resolveReady(),
    fontsObject: { ready: promise, status: ready ? "loaded" : "loading" },
  };
}

const Harness = defineComponent({
  props: { text: { type: String, required: true } },
  setup(props) {
    const container = ref<HTMLElement | null>(null);
    const text = ref<HTMLElement | null>(null);
    const content = ref(props.text);
    const { fontSize } = useFitText(container, text, content);
    return () =>
      h("div", { ref: container, style: "width: 200px; height: 100px;" }, [
        h("p", { ref: text, class: "fit-text" }, content.value),
      ]);
  },
});

describe("useFitText", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("re-measures against the real font once fonts finish loading, instead of reusing a size cached from the fallback font", async () => {
    const fonts = makeFontsController();
    // @ts-expect-error jsdom has no document.fonts
    document.fonts = fonts.fontsObject;

    document.documentElement.style.fontSize = "16px";
    const wrapper = mount(Harness, { props: { text: "UNIQUE CACHE KEY TEXT" } });
    const el = wrapper.find(".fit-text").element as HTMLElement;
    stubMeasurements(el, fonts.isReady);

    // Force the container to a known width (jsdom reports 0 by default).
    const containerEl = wrapper.element as HTMLElement;
    Object.defineProperty(containerEl, "clientWidth", { configurable: true, value: 200 });
    Object.defineProperty(containerEl, "clientHeight", { configurable: true, value: 100 });

    await nextTick();
    await nextTick();
    const sizeBeforeFontsReady = parseFloat(el.style.fontSize);

    fonts.finishLoading();
    await fonts.fontsObject.ready;
    await nextTick();
    await nextTick();
    const sizeAfterFontsReady = parseFloat(el.style.fontSize);

    // The real font is narrower, so the fitted size should be able to grow
    // once fonts are ready — not get stuck on the fallback-font size.
    expect(sizeAfterFontsReady).toBeGreaterThan(sizeBeforeFontsReady);
  });
});
