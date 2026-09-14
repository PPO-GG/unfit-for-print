// The Explorer page is wiring. Its children and composables are tested on
// their own; this suite checks the rules that only exist in the page: URL
// state, selection → loading, focus, the dirty guard, and action routing.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { computed, defineComponent, nextTick, onMounted, ref, watch } from "vue";
import type { AdminCard, AdminPack } from "~/types/adminCard";

vi.stubGlobal("definePageMeta", () => {});
vi.stubGlobal("defineShortcuts", vi.fn());
Object.assign(globalThis, { computed, ref, watch, onMounted, nextTick });

const routeQuery = ref<Record<string, string>>({});
const replace = vi.fn(({ query }: { query: Record<string, string | undefined> }) => {
  routeQuery.value = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined)) as Record<string, string>;
});
const push = vi.fn();
vi.stubGlobal("useRoute", () => ({ get query() { return routeQuery.value; } }));
vi.stubGlobal("useRouter", () => ({ replace, push }));

const pack = (id: string, over: Partial<AdminPack> = {}): AdminPack => ({
  id, name: `Pack ${id}`, series: null, description: null, icon: null, color: null, sortOrder: 0,
  official: false, nsfw: false, isDefault: false, legacyKey: null,
  white: { total: 1, active: 1 }, black: { total: 0, active: 0 }, ...over,
});
const card = (id: string, packId = "p1"): AdminCard => ({ id, type: "white", text: id, packId, pack: `Pack ${packId}`, active: true });

const packs = ref<AdminPack[]>([pack("p1", { legacyKey: "Old Name" }), pack("p2")]);
const cards = ref<AdminCard[]>([]);
const loadCards = vi.fn(async (ids: string[]) => {
  cards.value = ids.length ? ids.map((id) => card(`c-${id}`, id)) : [card("c-p1", "p1"), card("c-p2", "p2")];
});
vi.mock("~/composables/useAdminPackRoster", () => ({
  useAdminPackRoster: () => ({
    packs,
    byId: computed(() => new Map(packs.value.map((p) => [p.id, p]))),
    loading: ref(false),
    load: vi.fn(async () => {}),
    findByName: (n: string) => packs.value.find((p) => p.legacyKey === n || p.name === n),
  }),
}));
vi.mock("~/composables/useAdminCards", () => ({
  useAdminCards: () => ({ cards, loading: ref(false), load: loadCards }),
}));
const mutations = {
  busy: ref(false),
  mergePacks: vi.fn(async () => true),
  mergeSummary: vi.fn(() => "summary"),
  moveCards: vi.fn(async () => true),
  setPacksActive: vi.fn(async () => true),
  deletePacks: vi.fn(async () => true),
};
vi.mock("~/composables/useExplorerMutations", () => ({ useExplorerMutations: () => mutations }));
const confirm = vi.fn(async () => true);
vi.mock("~/composables/useConfirm", () => ({ useConfirm: () => ({ confirm }) }));
vi.mock("~/composables/useNotifications", () => ({ useNotifications: () => ({ notify: vi.fn() }) }));
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: vi.fn() }));

const dirty = ref(false);
const PackList = defineComponent({
  name: "AdminPackList",
  props: ["rows", "selectedIds"],
  emits: ["click", "all", "contextmenu"],
  template: `<div data-testid="pack-list">
    <button v-for="r in rows.filter(r => r.kind === 'pack')" :key="r.key" :data-testid="'pack-' + r.pack.id"
      @click="$emit('click', r.pack.id, { ctrlKey: $event.ctrlKey, metaKey: false, shiftKey: false })" />
  </div>`,
});
const CardTable = defineComponent({
  name: "AdminCardTable",
  props: ["cards", "selectedIds"],
  emits: ["click", "toggle", "open", "contextmenu"],
  template: `<div><button v-for="c in cards" :key="c.id" :data-testid="'card-' + c.id" @click="$emit('click', c.id, { ctrlKey: false, metaKey: false, shiftKey: false })" /></div>`,
});
const Inspector = defineComponent({
  name: "AdminExplorerInspector",
  props: ["focus", "packs", "cards"],
  emits: ["packs-merge"],
  setup(_, { expose }) {
    expose({ dirty, focusText: vi.fn(), focusName: vi.fn() });
    return {};
  },
  template: `<div data-testid="inspector" :data-focus="focus" :data-packs="packs.length" :data-cards="cards.length" />`,
});
const MergeDialog = defineComponent({
  name: "AdminMergeDialog",
  props: ["open", "sources", "packs"],
  emits: ["confirm", "update:open"],
  template: `<button data-testid="merge-dialog" :data-open="open" @click="$emit('confirm', packs[1])" />`,
});

const stubs = {
  AdminPackList: PackList,
  AdminCardTable: CardTable,
  AdminExplorerInspector: Inspector,
  AdminMergeDialog: MergeDialog,
  AdminCardGrid: true, AdminSelectionBar: true, AdminMoveDialog: true, AdminSeriesDialog: true,
  AdminCardManagerAddModal: true, NuxtLink: { template: "<a><slot /></a>" },
  UButton: { template: "<button v-bind='$attrs'><slot /></button>" }, UInput: true,
};

import ExplorerPage from "~/pages/admin/cards/index.vue";

async function mountPage(query: Record<string, string> = {}) {
  routeQuery.value = query;
  const w = mount(ExplorerPage, { global: { stubs } });
  await flushPromises();
  return w;
}

beforeEach(() => {
  vi.clearAllMocks();
  dirty.value = false;
  cards.value = [];
  localStorage.clear();
});

describe("Card Explorer page", () => {
  it("loads every card when no pack is selected", async () => {
    await mountPage();
    expect(loadCards).toHaveBeenLastCalledWith([]);
  });

  it("restores the pack selection from the URL, dropping unknown ids", async () => {
    await mountPage({ packs: "p2,gone" });
    expect(loadCards).toHaveBeenLastCalledWith(["p2"]);
    expect(routeQuery.value.packs).toBe("p2");
  });

  it("resolves a legacy ?pack=<name> link to an id", async () => {
    await mountPage({ pack: "Old Name" });
    expect(loadCards).toHaveBeenLastCalledWith(["p1"]);
    expect(routeQuery.value).toEqual({ packs: "p1" });
  });

  it("selecting packs reloads cards, clears the card selection and focuses packs", async () => {
    const w = await mountPage();
    await w.get("[data-testid='card-c-p1']").trigger("click");
    expect(w.get("[data-testid='inspector']").attributes("data-focus")).toBe("card");

    await w.get("[data-testid='pack-p1']").trigger("click");
    await w.get("[data-testid='pack-p2']").trigger("click", { ctrlKey: true });
    await flushPromises();

    expect(loadCards).toHaveBeenLastCalledWith(["p1", "p2"]);
    const inspector = w.get("[data-testid='inspector']");
    expect(inspector.attributes("data-focus")).toBe("pack");
    expect(inspector.attributes("data-packs")).toBe("2");
    expect(inspector.attributes("data-cards")).toBe("0");
    expect(routeQuery.value.packs).toBe("p1,p2");
  });

  it("asks before discarding a dirty editor, and respects Keep editing", async () => {
    const w = await mountPage();
    await w.get("[data-testid='pack-p1']").trigger("click");
    dirty.value = true;
    confirm.mockResolvedValueOnce(false);

    await w.get("[data-testid='pack-p2']").trigger("click");
    await flushPromises();

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ confirmButtonText: "Discard" }));
    expect(w.get("[data-testid='inspector']").attributes("data-packs")).toBe("1");
    expect(routeQuery.value.packs).toBe("p1");
  });

  it("merges into the chosen pack and selects it", async () => {
    const w = await mountPage();
    await w.get("[data-testid='pack-p1']").trigger("click");
    await w.get("[data-testid='pack-p2']").trigger("click", { ctrlKey: true });
    await w.getComponent(Inspector).vm.$emit("packs-merge");
    await nextTick();
    expect(w.get("[data-testid='merge-dialog']").attributes("data-open")).toBe("true");

    await w.get("[data-testid='merge-dialog']").trigger("click");
    await flushPromises();

    expect(mutations.mergePacks).toHaveBeenCalledWith([packs.value[0], packs.value[1]], packs.value[1]);
    expect(routeQuery.value.packs).toBe("p2");
  });
});
