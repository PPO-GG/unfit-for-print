import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DecorationStack from "~/components/decorations/DecorationStack.vue";
import { normalizeLayers } from "#shared/decorationLayers";

const avatar = { default: '<img class="avatar" src="a.png" />' };
const stack = (layers: unknown[]) => normalizeLayers({ v: 1, layers });

const order = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll(".deco-stack > *").map((el) =>
    el.classes("deco-stack__avatar") ? "avatar" : `${el.attributes("data-layer-type")}:${el.attributes("data-layer-id")}`,
  );

describe("DecorationStack", () => {
  it("renders behind layers, then the avatar, then front layers, keeping list order", () => {
    const wrapper = mount(DecorationStack, {
      props: {
        layers: stack([
          { type: "ring", id: "r1", side: "behind" },
          { type: "glow", id: "g1", side: "front" },
          { type: "glow", id: "g0", side: "behind" },
          { type: "ring", id: "r2", side: "front" },
        ]),
      },
      slots: avatar,
    });
    expect(order(wrapper)).toEqual(["ring:r1", "glow:g0", "avatar", "glow:g1", "ring:r2"]);
    expect(wrapper.find("img.avatar").exists()).toBe(true);
  });

  it("skips hidden layers and unknown types", () => {
    const layers = stack([{ type: "glow", id: "g", visible: false }, { type: "ring", id: "r" }]);
    layers.layers.push({ ...layers.layers[1]!, id: "x", type: "laser" } as never);
    const wrapper = mount(DecorationStack, { props: { layers }, slots: avatar });
    expect(order(wrapper)).toEqual(["ring:r", "avatar"]);
  });

  it("passes the avatar straight through for an empty or missing stack", () => {
    for (const layers of [null, { v: 1 as const, layers: [] }]) {
      const wrapper = mount(DecorationStack, { props: { layers }, slots: avatar });
      expect(order(wrapper)).toEqual(["avatar"]);
    }
  });

  it("applies clip and opacity on the layer wrapper", () => {
    const wrapper = mount(DecorationStack, {
      props: { layers: stack([{ type: "glow", id: "g", clip: true, opacity: 0.5 }]) },
      slots: avatar,
    });
    const layer = wrapper.find('[data-layer-id="g"]');
    expect(layer.classes()).toContain("deco-stack__layer--clip");
    expect(layer.attributes("style")).toContain("opacity: 0.5");
  });

  it("renders particleCount particles for the measured size (48px default in jsdom)", () => {
    const wrapper = mount(DecorationStack, {
      props: { layers: stack([{ type: "particles", id: "p", count: 9, motion: "orbit" }]) },
      slots: avatar,
    });
    expect(wrapper.findAll(".deco-particles__p")).toHaveLength(6);
    expect(wrapper.find(".deco-particles").classes()).toContain("deco-anim-spin");
  });

  it("uses rise animation on each particle and no container spin for rising particles", () => {
    const wrapper = mount(DecorationStack, {
      props: { layers: stack([{ type: "particles", id: "p", motion: "rise" }]) },
      slots: avatar,
    });
    expect(wrapper.find(".deco-particles").classes()).not.toContain("deco-anim-spin");
    expect(wrapper.find(".deco-particles__inner").classes()).toContain("deco-anim-rise");
  });

  it("renders image particles from the decoration image proxy", () => {
    const wrapper = mount(DecorationStack, {
      props: {
        layers: stack([{ type: "particles", id: "p", shape: "image", asset: { key: "deco-1-star.svg", format: "svg" } }]),
      },
      slots: avatar,
    });
    expect(wrapper.find(".deco-particles__p img").attributes("src")).toBe("/api/decorations/images/deco-1-star.svg");
  });

  it("renders an image layer only once it has an asset", () => {
    const withAsset = mount(DecorationStack, {
      props: {
        layers: stack([{ type: "image", id: "i", idle: "bob", asset: { key: "deco-1-hat.png", format: "png" } }]),
      },
      slots: avatar,
    });
    const img = withAsset.find("img.deco-image");
    expect(img.attributes("src")).toBe("/api/decorations/images/deco-1-hat.png");
    expect(img.classes()).toContain("deco-anim-bob");

    const empty = mount(DecorationStack, { props: { layers: stack([{ type: "image", id: "i" }]) }, slots: avatar });
    expect(empty.find("img.deco-image").exists()).toBe(false);
  });
});
