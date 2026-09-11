import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminDecoContextStrip from "~/components/admin/AdminDecoContextStrip.vue";
import { normalizeLayers } from "#shared/decorationLayers";

describe("AdminDecoContextStrip", () => {
  it("previews the stack at the real header, seat and profile sizes", () => {
    const stack = normalizeLayers({ v: 1, layers: [{ type: "ring", id: "r" }] });
    const w = mount(AdminDecoContextStrip, { props: { stack, sample: "initials" } });
    for (const [name, px] of [["header", 24], ["seat", 40], ["profile", 96]] as const) {
      const cell = w.find(`[data-testid="context-${name}"]`);
      expect(cell.find(".deco-stack").exists(), name).toBe(true);
      expect(cell.find('[data-testid="sample-avatar"]').attributes("style")).toContain(`width: ${px}px`);
    }
  });
});
