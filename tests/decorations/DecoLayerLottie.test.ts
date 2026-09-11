import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const created: Record<string, unknown>[] = [];
const destroyed = vi.fn();
const setSpeed = vi.fn();
vi.mock("@lottiefiles/dotlottie-web", () => ({
  DotLottie: class {
    constructor(opts: Record<string, unknown>) {
      created.push(opts);
    }
    destroy = destroyed;
    setSpeed = setSpeed;
  },
}));

import DecoLayerLottie from "~/components/decorations/DecoLayerLottie.vue";
import { normalizeLayers, type LottieLayer } from "#shared/decorationLayers";

const layer = (over: Record<string, unknown> = {}) =>
  normalizeLayers({
    v: 1,
    layers: [{ type: "lottie", id: "l", asset: { key: "deco-1-anim.json", format: "lottie" }, speed: 1.5, ...over }],
  }).layers[0] as LottieLayer;

beforeEach(() => {
  created.length = 0;
  destroyed.mockReset();
  setSpeed.mockReset();
});

describe("DecoLayerLottie", () => {
  it("boots one player with the proxied src and layer speed (no IntersectionObserver in jsdom)", async () => {
    mount(DecoLayerLottie, { props: { layer: layer() } });
    await flushPromises();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ src: "/api/decorations/images/deco-1-anim.json", speed: 1.5, loop: true });
  });

  it("updates speed in place and destroys the player on unmount", async () => {
    const wrapper = mount(DecoLayerLottie, { props: { layer: layer() } });
    await flushPromises();
    await wrapper.setProps({ layer: layer({ speed: 2 }) });
    expect(setSpeed).toHaveBeenCalledWith(2);
    wrapper.unmount();
    expect(destroyed).toHaveBeenCalled();
  });

  it("renders nothing and boots nothing without an asset", async () => {
    const wrapper = mount(DecoLayerLottie, { props: { layer: layer({ asset: null }) } });
    await flushPromises();
    expect(wrapper.find("canvas").exists()).toBe(false);
    expect(created).toHaveLength(0);
  });
});
