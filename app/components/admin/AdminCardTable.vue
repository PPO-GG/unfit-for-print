<script setup lang="ts">
/**
 * The Explorer's card table. It renders rows in the order it is given — the
 * page filters and sorts, because the same order drives Shift ranges — and
 * reports clicks; selection state lives in the page.
 */
import { h, resolveComponent } from "vue";
import type { ContextMenuItem, TableColumn } from "@nuxt/ui";
import type { AdminCard } from "~/types/adminCard";
import type { CardSort, CardSortKey } from "~/utils/cardTableView";
import { cardRate } from "~/composables/useAdminCardStats";

const props = defineProps<{
  cards: AdminCard[];
  selectedIds: string[];
  currentId?: string | null;
  menu: ContextMenuItem[][];
  loading?: boolean;
}>();

const sort = defineModel<CardSort | null>("sort", { required: true });

const emit = defineEmits<{
  click: [id: string, mods: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }];
  toggle: [id: string];
  open: [id: string];
  contextmenu: [id: string];
}>();

const UCheckbox = resolveComponent("UCheckbox");
const UBadge = resolveComponent("UBadge");

const DOUBLE_CLICK_MS = 350;
let lastClick: { id: string; at: number } | null = null;

const modsOf = (e: Event) => {
  const m = e as MouseEvent;
  return { ctrlKey: Boolean(m.ctrlKey), metaKey: Boolean(m.metaKey), shiftKey: Boolean(m.shiftKey) };
};

function onSelect(e: Event, row: { original: AdminCard }) {
  const id = row.original.id;
  const now = Date.now();
  if (lastClick && lastClick.id === id && now - lastClick.at <= DOUBLE_CLICK_MS) {
    lastClick = null;
    emit("open", id);
    return;
  }
  lastClick = { id, at: now };
  emit("click", id, modsOf(e));
}

function onContextmenu(_e: Event, row: { original: AdminCard }) {
  const id = row.original.id;
  if (!props.selectedIds.includes(id)) {
    emit("click", id, { ctrlKey: false, metaKey: false, shiftKey: false });
  }
  emit("contextmenu", id);
}

function rowClass(row: { original: AdminCard }) {
  const id = row.original.id;
  return [
    "cursor-default select-none",
    props.selectedIds.includes(id) ? "bg-primary-900/40" : "",
    id === props.currentId ? "ring-1 ring-inset ring-primary-500/60" : "",
    row.original.active === false ? "opacity-60" : "",
  ].join(" ");
}

function cycleSort(key: CardSortKey) {
  const current = sort.value;
  if (!current || current.key !== key) sort.value = { key, desc: false };
  else if (!current.desc) sort.value = { key, desc: true };
  else sort.value = null;
}

const header = (label: string, key: CardSortKey) => () =>
  h(
    "button",
    {
      type: "button",
      class: "flex items-center gap-1 text-xs font-medium",
      onClick: () => cycleSort(key),
    },
    [label, sort.value?.key === key ? (sort.value.desc ? " ↓" : " ↑") : ""],
  );

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const columns: TableColumn<AdminCard>[] = [
  {
    id: "select",
    header: "",
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: props.selectedIds.includes(row.original.id),
        "aria-label": "Select card",
        onClick: (e: Event) => e.stopPropagation(),
        "onUpdate:modelValue": () => emit("toggle", row.original.id),
      }),
  },
  {
    id: "text",
    header: header("Text", "text"),
    cell: ({ row }) =>
      h("span", { class: "block truncate max-w-[36rem]" }, row.original.imageKey ? "🖼 Image" : (row.original.text ?? "")),
  },
  {
    id: "type",
    header: header("Type", "type"),
    cell: ({ row }) =>
      h(UBadge, { size: "sm", variant: row.original.type === "black" ? "solid" : "soft", color: "neutral" }, () => row.original.type),
  },
  { id: "pack", header: header("Pack", "pack"), cell: ({ row }) => h("span", { class: "truncate" }, row.original.pack ?? "—") },
  { id: "played", header: header("Played", "played"), cell: ({ row }) => (row.original.timesPlayed ?? 0).toLocaleString() },
  {
    id: "rate",
    header: header("Win / skip", "rate"),
    cell: ({ row }) => {
      const r = cardRate(row.original);
      return r.value === null ? "—" : pct(r.value);
    },
  },
  {
    id: "active",
    header: header("Active", "active"),
    cell: ({ row }) =>
      h("span", { class: row.original.active === false ? "text-slate-500" : "text-green-400" }, row.original.active === false ? "○" : "●"),
  },
];

defineExpose({ rowClass, cycleSort });
</script>

<template>
  <UContextMenu :items="menu">
    <div class="h-full min-h-0">
      <UTable
        class="h-full"
        virtualize
        sticky
        :data="cards"
        :columns="columns"
        :loading="loading"
        :get-row-id="(r: AdminCard) => r.id"
        :meta="{ class: { tr: rowClass } }"
        @select="onSelect"
        @contextmenu="onContextmenu"
      />
    </div>
  </UContextMenu>
</template>
