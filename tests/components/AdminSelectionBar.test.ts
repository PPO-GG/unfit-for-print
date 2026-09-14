import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminSelectionBar from "~/components/admin/AdminSelectionBar.vue";
import type { ExplorerAction } from "~/composables/useExplorerActions";

const actions: ExplorerAction[] = [
  { id: "merge", scope: "pack", label: "Merge into…", icon: "i", enabled: true },
  { id: "delete-packs", scope: "pack", label: "Delete 2 packs…", icon: "i", danger: true, enabled: true },
];
const stubs = { UButton: { template: "<button v-bind='$attrs'><slot /></button>" }, UKbd: true };

describe("AdminSelectionBar", () => {
  it("renders the label and one button per action, and emits run and clear", async () => {
    const w = mount(AdminSelectionBar, { props: { label: "2 packs selected", actions }, global: { stubs } });
    expect(w.text()).toContain("2 packs selected");
    await w.get("[data-testid='bar-delete-packs']").trigger("click");
    await w.get("[data-testid='bar-clear']").trigger("click");
    expect(w.emitted("run")?.[0]).toEqual(["delete-packs"]);
    expect(w.emitted("clear")).toHaveLength(1);
  });
});
