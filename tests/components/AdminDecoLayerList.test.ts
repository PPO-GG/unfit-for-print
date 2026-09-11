import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminDecoLayerList from "~/components/admin/AdminDecoLayerList.vue";
import { normalizeLayers } from "#shared/decorationLayers";

const stubs = {
  UButton: { template: '<button v-bind="$attrs"><slot /></button>' },
  UIcon: { template: "<i />" },
};
const stack = normalizeLayers({
  v: 1,
  layers: [
    { type: "ring", id: "b1", side: "behind" },
    { type: "glow", id: "f1", side: "front" },
    { type: "glow", id: "b2", side: "behind", name: "Halo" },
  ],
});
const mountList = (selectedId: string | null = null) =>
  mount(AdminDecoLayerList, { props: { stack, selectedId }, global: { stubs } });
const row = (w: ReturnType<typeof mountList>, id: string) => w.find(`[data-testid="layer-row-${id}"]`);

describe("AdminDecoLayerList", () => {
  it("shows front top-first, the avatar row, then behind top-first", () => {
    const w = mountList();
    const order = w.findAll('[data-testid^="layer-row-"], [data-testid="layer-avatar-row"]')
      .map((el) => el.attributes("data-testid"));
    expect(order).toEqual(["layer-row-f1", "layer-avatar-row", "layer-row-b2", "layer-row-b1"]);
    expect(row(w, "b2").text()).toContain("Halo");
    expect(row(w, "b1").text()).toContain("Ring");
  });

  it("selects, toggles visibility, duplicates and removes", async () => {
    const w = mountList("f1");
    expect(row(w, "f1").classes()).toContain("is-selected");
    await row(w, "b1").find('[data-testid="layer-select"]').trigger("click");
    await row(w, "b1").find('[data-testid="layer-eye"]').trigger("click");
    await row(w, "b1").find('[data-testid="layer-duplicate"]').trigger("click");
    await row(w, "b1").find('[data-testid="layer-remove"]').trigger("click");
    expect(w.emitted("select")?.[0]).toEqual(["b1"]);
    expect(w.emitted("toggle-visible")?.[0]).toEqual(["b1"]);
    expect(w.emitted("duplicate")?.[0]).toEqual(["b1"]);
    expect(w.emitted("remove")?.[0]).toEqual(["b1"]);
  });

  it("reorders within a side and crosses the avatar at the edges", async () => {
    const w = mountList();
    await row(w, "b2").find('[data-testid="layer-down"]').trigger("click");
    expect(w.emitted("move")?.at(-1)).toEqual(["b2", "behind", 1]);
    await row(w, "f1").find('[data-testid="layer-down"]').trigger("click");
    expect(w.emitted("move")?.at(-1)).toEqual(["f1", "behind", 0]);
    await row(w, "b2").find('[data-testid="layer-up"]').trigger("click");
    expect(w.emitted("move")?.at(-1)).toEqual(["b2", "front", 1]);
  });

  it("adds each layer type", async () => {
    const w = mountList();
    for (const type of ["glow", "ring", "particles", "image", "lottie"]) {
      await w.find(`[data-testid="add-${type}"]`).trigger("click");
    }
    expect(w.emitted("add")?.map(([t]) => t)).toEqual(["glow", "ring", "particles", "image", "lottie"]);
  });

  it("renames inline on double-click and Enter", async () => {
    const w = mountList();
    await row(w, "b1").find('[data-testid="layer-name"]').trigger("dblclick");
    const input = row(w, "b1").find('[data-testid="layer-rename"]');
    await input.setValue("Gold");
    await input.trigger("keydown.enter");
    expect(w.emitted("rename")?.[0]).toEqual(["b1", "Gold"]);
  });
});
