import { describe, it, expect } from "vitest";
import { nextTick, ref } from "vue";
import { useListSelection } from "~/composables/useListSelection";

describe("useListSelection", () => {
  it("applies clicks against the live order", () => {
    const order = ref(["a", "b", "c"]);
    const sel = useListSelection(order);

    sel.click("a");
    sel.click("c", { shiftKey: true });

    expect(sel.selected.value).toEqual(["a", "b", "c"]);
    expect(sel.isSelected("b")).toBe(true);
  });

  it("toggle behaves like Ctrl-click", () => {
    const sel = useListSelection(ref(["a", "b"]));
    sel.toggle("a");
    sel.toggle("b");
    sel.toggle("a");
    expect(sel.selected.value).toEqual(["b"]);
  });

  it("selectAll takes the visible order; clear empties; remove drops one", () => {
    const sel = useListSelection(ref(["a", "b", "c"]));
    sel.selectAll();
    expect(sel.selected.value).toEqual(["a", "b", "c"]);
    sel.remove("b");
    expect(sel.selected.value).toEqual(["a", "c"]);
    sel.clear();
    expect(sel.selected.value).toEqual([]);
    expect(sel.anchor.value).toBeNull();
  });

  it("prunes ids that leave the order", async () => {
    const order = ref(["a", "b", "c"]);
    const sel = useListSelection(order);
    sel.set(["a", "c"]);

    order.value = ["a", "b"];
    await nextTick();

    expect(sel.selected.value).toEqual(["a"]);
  });
});
