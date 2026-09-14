/**
 * File-explorer selection rules, shared by the pack list and the card table.
 *
 * `order` is always the on-screen order after filters and sorting, never the
 * loaded set: a Shift range must only cover rows the admin can see, or a
 * bulk action would reach cards hidden by a chip.
 */
export type SelectionState = { selected: string[]; anchor: string | null };
export type ClickModifiers = { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean };

export function applyClick(
  state: SelectionState,
  id: string,
  mods: ClickModifiers,
  order: string[],
): SelectionState {
  if (mods.shiftKey && state.anchor !== null) {
    const from = order.indexOf(state.anchor);
    const to = order.indexOf(id);
    if (from !== -1 && to !== -1) {
      const [lo, hi] = from < to ? [from, to] : [to, from];
      const range = order.slice(lo, hi + 1);
      return { selected: [...new Set([...state.selected, ...range])], anchor: state.anchor };
    }
  }

  if (mods.ctrlKey || mods.metaKey) {
    const selected = state.selected.includes(id)
      ? state.selected.filter((s) => s !== id)
      : [...state.selected, id];
    return { selected, anchor: id };
  }

  return { selected: [id], anchor: id };
}

export function pruneSelection(state: SelectionState, order: string[]): SelectionState {
  const visible = new Set(order);
  const selected = state.selected.filter((id) => visible.has(id));
  const anchor = state.anchor !== null && visible.has(state.anchor) ? state.anchor : null;
  if (selected.length === state.selected.length && anchor === state.anchor) return state;
  return { selected, anchor };
}
