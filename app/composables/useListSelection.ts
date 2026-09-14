import { ref, watch, type Ref } from "vue";
import {
  applyClick,
  pruneSelection,
  type ClickModifiers,
  type SelectionState,
} from "~/utils/listSelection";

export function useListSelection(order: Ref<string[]>) {
  const selected = ref<string[]>([]);
  const anchor = ref<string | null>(null);

  const commit = (next: SelectionState) => {
    selected.value = next.selected;
    anchor.value = next.anchor;
  };
  const current = (): SelectionState => ({ selected: selected.value, anchor: anchor.value });

  function click(id: string, mods: ClickModifiers = {}) {
    commit(applyClick(current(), id, mods, order.value));
  }

  const toggle = (id: string) => click(id, { ctrlKey: true });

  function set(ids: string[]) {
    commit({ selected: [...new Set(ids)], anchor: ids.at(-1) ?? null });
  }

  const selectAll = () => commit({ selected: [...order.value], anchor: anchor.value });
  const clear = () => commit({ selected: [], anchor: null });
  const remove = (id: string) =>
    commit({
      selected: selected.value.filter((s) => s !== id),
      anchor: anchor.value === id ? null : anchor.value,
    });
  const isSelected = (id: string) => selected.value.includes(id);

  // pruneSelection returns its input object untouched when nothing changed,
  // so an identity check is enough to skip a no-op write.
  watch(order, (next) => {
    const before = current();
    const pruned = pruneSelection(before, next);
    if (pruned !== before) commit(pruned);
  });

  return { selected, anchor, click, toggle, set, selectAll, clear, remove, isSelected };
}

export type ListSelection = ReturnType<typeof useListSelection>;
