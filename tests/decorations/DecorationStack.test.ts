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
});
