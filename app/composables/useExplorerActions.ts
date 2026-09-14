/**
 * One definition per action, read by the context menu, the selection bar and
 * the keyboard. Keeping all three on this list is what stops a shortcut from
 * doing something the menu says is unavailable.
 */
import { computed, type Ref } from "vue";
import type { ContextMenuItem } from "@nuxt/ui";
import type { AdminCard, AdminPack } from "~/types/adminCard";
import { isPackDisabled } from "~/utils/packListView";

export type PackActionId =
  | "rename"
  | "merge"
  | "enable-packs"
  | "disable-packs"
  | "toggle-default"
  | "set-series"
  | "check-duplicates"
  | "delete-packs";
export type CardActionId = "move" | "enable-cards" | "disable-cards" | "copy-text" | "delete-cards";
export type ActionId = PackActionId | CardActionId;
export type ActionScope = "pack" | "card";

export interface ExplorerAction {
  id: ActionId;
  scope: ActionScope;
  label: string;
  icon: string;
  kbd?: string;
  danger?: boolean;
  enabled: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const SINGLE_ITEM: ActionId[] = ["rename", "copy-text"];

export function packActions(packs: AdminPack[]): ExplorerAction[] {
  const n = packs.length;
  const allDefault = n > 0 && packs.every((p) => p.isDefault);
  const a = (x: Omit<ExplorerAction, "scope">): ExplorerAction => ({ ...x, scope: "pack" });
  return [
    a({ id: "rename", label: "Rename…", icon: "i-solar-pen-linear", kbd: "f2", enabled: n === 1 }),
    a({ id: "merge", label: "Merge into…", icon: "i-solar-layers-linear", enabled: n >= 1 }),
    a({ id: "enable-packs", label: "Enable", icon: "i-solar-eye-linear", enabled: packs.some(isPackDisabled) }),
    a({ id: "disable-packs", label: "Disable", icon: "i-solar-eye-closed-linear", enabled: packs.some((p) => !isPackDisabled(p)) }),
    a({ id: "toggle-default", label: allDefault ? "Unset default" : "Set as default", icon: "i-solar-star-linear", enabled: n >= 1 }),
    a({ id: "set-series", label: "Set series…", icon: "i-solar-tag-linear", enabled: n >= 1 }),
    a({ id: "check-duplicates", label: "Check duplicates", icon: "i-solar-copy-linear", enabled: n >= 1 }),
    a({ id: "delete-packs", label: `Delete ${plural(n, "pack")}…`, icon: "i-solar-trash-bin-trash-linear", kbd: "delete", danger: true, enabled: n >= 1 }),
  ];
}

export function cardActions(cards: AdminCard[]): ExplorerAction[] {
  const n = cards.length;
  const a = (x: Omit<ExplorerAction, "scope">): ExplorerAction => ({ ...x, scope: "card" });
  return [
    a({ id: "move", label: "Move to pack…", icon: "i-solar-folder-with-files-linear", enabled: n >= 1 }),
    a({ id: "enable-cards", label: "Enable", icon: "i-solar-eye-linear", enabled: cards.some((c) => c.active === false) }),
    a({ id: "disable-cards", label: "Disable", icon: "i-solar-eye-closed-linear", enabled: cards.some((c) => c.active !== false) }),
    a({ id: "copy-text", label: "Copy text", icon: "i-solar-clipboard-linear", enabled: n === 1 && Boolean(cards[0]?.text?.trim()) }),
    a({ id: "delete-cards", label: `Delete ${plural(n, "card")}…`, icon: "i-solar-trash-bin-trash-linear", kbd: "delete", danger: true, enabled: n >= 1 }),
  ];
}

export function useExplorerActions(opts: {
  packs: Ref<AdminPack[]>;
  cards: Ref<AdminCard[]>;
  focus: Ref<ActionScope>;
  run: (id: ActionId) => void;
  selectAll: (scope: ActionScope) => void;
  clear: (scope: ActionScope) => void;
}) {
  const packList = computed(() => packActions(opts.packs.value));
  const cardList = computed(() => cardActions(opts.cards.value));

  const toMenu = (actions: ExplorerAction[]): ContextMenuItem[][] => {
    const item = (x: ExplorerAction): ContextMenuItem => ({
      label: x.label,
      icon: x.icon,
      kbds: x.kbd ? [x.kbd] : undefined,
      disabled: !x.enabled,
      color: x.danger ? "error" : undefined,
      onSelect: () => opts.run(x.id),
    });
    return [actions.filter((x) => !x.danger).map(item), actions.filter((x) => x.danger).map(item)];
  };

  const bar = (actions: ExplorerAction[]) =>
    actions.filter((x) => x.enabled && !SINGLE_ITEM.includes(x.id));

  const runIfEnabled = (actions: ExplorerAction[], id: ActionId) => {
    if (actions.find((x) => x.id === id)?.enabled) opts.run(id);
  };

  const shortcuts = computed<Record<string, () => void>>(() => ({
    f2: () => runIfEnabled(packList.value, "rename"),
    delete: () =>
      opts.focus.value === "pack"
        ? runIfEnabled(packList.value, "delete-packs")
        : runIfEnabled(cardList.value, "delete-cards"),
    escape: () => opts.clear(opts.focus.value),
    meta_a: () => opts.selectAll(opts.focus.value),
  }));

  return {
    packMenu: computed(() => toMenu(packList.value)),
    cardMenu: computed(() => toMenu(cardList.value)),
    packBar: computed(() => bar(packList.value)),
    cardBar: computed(() => bar(cardList.value)),
    shortcuts,
  };
}
