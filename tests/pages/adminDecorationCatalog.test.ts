import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, enableAutoUnmount } from "@vue/test-utils";
import { normalizeLayers } from "#shared/decorationLayers";

const h = vi.hoisted(() => ({ notify: vi.fn(), push: vi.fn() }));
vi.stubGlobal("definePageMeta", () => {});
const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));
vi.mock("~/composables/useNotifications", () => ({ useNotifications: () => ({ notify: h.notify }) }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: h.push }) }));

import CatalogPage from "~/pages/admin/decorations/index.vue";
import AdminDecoNewModal from "~/components/admin/AdminDecoNewModal.vue";

enableAutoUnmount(afterEach);

const deco = (id: string, over: Record<string, unknown> = {}) => ({
  $id: id, decorationId: id, name: id.replace(/-/g, " "), description: "", type: "layered",
  rarity: "common", category: "custom", enabled: true, freeForAll: false, discordSkuId: null,
  price: 0, sortOrder: 0, imageFileId: null, imageFormat: null, attachment: null,
  layers: normalizeLayers({ v: 1, layers: [] }), ...over,
});
const catalog = [deco("gold-ring", { rarity: "legendary" }), deco("party-hat", { enabled: false }), deco("free-cat", { freeForAll: true })];

const base = {
  NuxtLink: { props: ["to"], template: '<a :href="to" v-bind="$attrs"><slot /></a>' },
  UButton: { template: '<button v-bind="$attrs"><slot /></button>' },
  UIcon: { template: "<i />" },
  UBadge: { template: "<span><slot /></span>" },
  UInput: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<input v-bind="$attrs" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
  USelect: {
    props: ["modelValue", "items"],
    emits: ["update:modelValue"],
    template: `<select v-bind="$attrs" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><option v-for="i in items" :key="i.value" :value="i.value">{{ i.label }}</option></select>`,
  },
};
const pageStubs = {
  ...base,
  AdminDecoNewModal: {
    props: ["open"],
    emits: ["create", "update:open"],
    template: `<div v-if="open"><button data-testid="modal-create" @click="$emit('create', { name: 'Neon', starter: 'glow-ring' })" /></div>`,
  },
};

async function mountPage() {
  const w = mount(CatalogPage, { global: { stubs: pageStubs } });
  await flushPromises();
  return w;
}

beforeEach(() => {
  h.notify.mockReset();
  h.push.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "/api/admin/decorations/list") return catalog;
    if (url === "/api/admin/decorations") return { $id: "neon", decorationId: "neon", name: "Neon" };
    if (url === "/api/admin/decorations/assets/prune") return { scanned: 7, deleted: 2 };
    return {};
  });
});

describe("decoration catalog page", () => {
  it("shows a tile per decoration and the stats", async () => {
    const w = await mountPage();
    expect(w.findAll('[data-testid="deco-tile"]')).toHaveLength(3);
    expect(w.find('[data-testid="stat-total"]').text()).toContain("3");
    expect(w.find('[data-testid="stat-live"]').text()).toContain("2");
    expect(w.find('[data-testid="stat-free"]').text()).toContain("1");
  });

  it("filters by search and by status", async () => {
    const w = await mountPage();
    await w.find('[data-testid="catalog-search"]').setValue("hat");
    expect(w.findAll('[data-testid="deco-tile"]')).toHaveLength(1);
    await w.find('[data-testid="catalog-search"]').setValue("");
    await w.find('[data-testid="status-hidden"]').trigger("click");
    const tiles = w.findAll('[data-testid="deco-tile"]');
    expect(tiles).toHaveLength(1);
    expect(tiles[0]!.attributes("href")).toBe("/admin/decorations/party-hat");
  });

  it("creates a decoration and opens it in the studio", async () => {
    const w = await mountPage();
    await w.find('[data-testid="catalog-new"]').trigger("click");
    await w.find('[data-testid="modal-create"]').trigger("click");
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/decorations", {
      method: "POST",
      body: { name: "Neon", starter: "glow-ring" },
    });
    expect(h.push).toHaveBeenCalledWith("/admin/decorations/neon");
  });

  it("cleans up unused files and reports the count", async () => {
    const w = await mountPage();
    await w.find('[data-testid="catalog-prune"]').trigger("click");
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/decorations/assets/prune", { method: "POST" });
    expect(h.notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Deleted 2 unused files" }));
  });
});

describe("AdminDecoNewModal", () => {
  const stubs = { ...base, UModal: { props: ["open"], template: '<div v-if="open"><slot name="content" /></div>' } };
  const mountModal = () => mount(AdminDecoNewModal, { props: { open: true, catalog }, global: { stubs } });

  it("asks for a name before creating", async () => {
    const w = mountModal();
    await w.find('[data-testid="new-create"]').trigger("click");
    expect(w.find('[data-testid="new-name-error"]').text()).toMatch(/enter a name/i);
    expect(w.emitted("create")).toBeUndefined();
  });

  it("previews the id and creates from a starter", async () => {
    const w = mountModal();
    await w.find('[data-testid="new-name"]').setValue("Neon Waves");
    expect(w.text()).toContain("neon-waves");
    await w.find('[data-testid="starter-sparkles"]').trigger("click");
    await w.find('[data-testid="new-create"]').trigger("click");
    expect(w.emitted("create")?.[0]).toEqual([{ name: "Neon Waves", starter: "sparkles" }]);
  });

  it("creates a copy of an existing decoration", async () => {
    const w = mountModal();
    await w.find('[data-testid="new-name"]').setValue("Gold Two");
    await w.find('[data-testid="starter-copy"]').trigger("click");
    await w.find('[data-testid="new-copy-from"]').setValue("party-hat");
    await w.find('[data-testid="new-create"]').trigger("click");
    expect(w.emitted("create")?.[0]).toEqual([{ name: "Gold Two", copyFrom: "party-hat" }]);
  });

  it("sends a custom id when one is typed", async () => {
    const w = mountModal();
    await w.find('[data-testid="new-name"]').setValue("Gold Ring");
    await w.find('[data-testid="new-slug"]').setValue("founders-gold");
    expect(w.text()).toContain("founders-gold");
    await w.find('[data-testid="new-create"]').trigger("click");
    expect(w.emitted("create")?.[0]).toEqual([{ name: "Gold Ring", starter: "blank", slug: "founders-gold" }]);
  });
});
