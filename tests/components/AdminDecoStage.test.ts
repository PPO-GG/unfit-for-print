import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminDecoStage from "~/components/admin/AdminDecoStage.vue";
import { normalizeLayers } from "#shared/decorationLayers";

const stack = normalizeLayers({
  v: 1,
  layers: [
    { type: "glow", id: "g" },
    { type: "image", id: "hat", transform: { x: 0, y: -0.5, scale: 0.5, rotation: 0 } },
  ],
});

// jsdom has no layout: give the stage a 400×400 box so its centre is (200, 200).
function mountStage(selectedId: string | null) {
  const w = mount(AdminDecoStage, { props: { stack, selectedId, background: "dark", sample: "initials" } });
  const stage = w.find('[data-testid="stage"]').element as HTMLElement;
  stage.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return w;
}

describe("AdminDecoStage", () => {
  it("shows handles only for a selected transformable layer", () => {
    expect(mountStage("hat").find('[data-testid="handle-box"]').exists()).toBe(true);
    expect(mountStage("g").find('[data-testid="handle-box"]').exists()).toBe(false);
    expect(mountStage(null).find('[data-testid="handle-box"]').exists()).toBe(false);
  });

  it("selects the layer under a click", async () => {
    const w = mountStage(null);
    // hat is centred at (200, 200 - 100) with a 100px box
    await w.find('[data-testid="stage"]').trigger("click", { clientX: 210, clientY: 90 });
    expect(w.emitted("select")?.[0]).toEqual(["hat"]);
  });

  it("drags the box to move, in avatar diameters", async () => {
    const w = mountStage("hat");
    await w.find('[data-testid="handle-box"]').trigger("pointerdown", { clientX: 200, clientY: 100, pointerId: 1 });
    await w.find('[data-testid="stage"]').trigger("pointermove", { clientX: 240, clientY: 100, pointerId: 1 });
    await w.find('[data-testid="stage"]').trigger("pointerup", { pointerId: 1 });
    expect(w.emitted("update")?.at(-1)).toEqual(["hat", { transform: { x: 0.2, y: -0.5, scale: 0.5, rotation: 0 } }]);
  });

  it("scales from the corner and rotates from the dot", async () => {
    const w = mountStage("hat");
    const stageEl = w.find('[data-testid="stage"]');
    await w.find('[data-testid="handle-scale"]').trigger("pointerdown", { clientX: 250, clientY: 150, pointerId: 1 });
    await stageEl.trigger("pointermove", { clientX: 300, clientY: 150, pointerId: 1 });
    expect(w.emitted("update")?.at(-1)).toEqual(["hat", { transform: { x: 0, y: -0.5, scale: 1, rotation: 0 } }]);
    await stageEl.trigger("pointerup", { pointerId: 1 });

    await w.find('[data-testid="handle-rotate"]').trigger("pointerdown", { clientX: 200, clientY: 40, pointerId: 1 });
    await stageEl.trigger("pointermove", { clientX: 260, clientY: 100, pointerId: 1 });
    expect(w.emitted("update")?.at(-1)).toEqual(["hat", { transform: { x: 0, y: -0.5, scale: 0.5, rotation: 90 } }]);
  });
});
