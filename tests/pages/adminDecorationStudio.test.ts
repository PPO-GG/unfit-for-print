import { describe, it, expect, vi, beforeEach } from "vitest";
import { afterEach } from "vitest";
import { mount, flushPromises, enableAutoUnmount } from "@vue/test-utils";
import { normalizeLayers } from "#shared/decorationLayers";

// Every mount registers window keydown/beforeunload listeners; unmount between tests.
enableAutoUnmount(afterEach);

const h = vi.hoisted(() => ({
  notify: vi.fn(),
  confirm: vi.fn(),
  push: vi.fn(),
  leave: { guard: null as null | (() => unknown) },
}));

vi.stubGlobal("definePageMeta", () => {});
const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));
vi.mock("~/composables/useNotifications", () => ({ useNotifications: () => ({ notify: h.notify }) }));
vi.mock("~/composables/useConfirm", () => ({ useConfirm: () => ({ confirm: h.confirm }) }));
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { id: "halo" } }),
  useRouter: () => ({ push: h.push }),
  onBeforeRouteLeave: (fn: () => unknown) => {
    h.leave.guard = fn;
  },
}));

import StudioPage from "~/pages/admin/decorations/[id].vue";

let owners: unknown[] = [];
const entry = {
  $id: "halo", decorationId: "halo", name: "Halo", description: "", type: "layered", rarity: "rare",
  category: "effect", enabled: true, freeForAll: false, discordSkuId: null, price: 2, sortOrder: 5,
  imageFileId: null, imageFormat: null, attachment: null,
  layers: normalizeLayers({ v: 1, layers: [{ type: "ring", id: "r" }] }),
};

const stubs = {
  NuxtLink: { template: "<a><slot /></a>" },
  UButton: { template: '<button v-bind="$attrs"><slot /></button>' },
  UBadge: { template: "<span><slot /></span>" },
  UTabs: { template: '<div><slot name="look" /><slot name="listing" /><slot name="owners" /></div>' },
  AdminDecoLayerList: true,
  AdminDecoInspector: true,
  AdminDecoStage: true,
  AdminDecoContextStrip: true,
  AdminDecoOwners: true,
  AdminDecoListing: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<button data-testid="rename" @click="$emit('update:modelValue', { ...modelValue, name: 'Halo 2' })" />`,
  },
  AdminDecoDeleteModal: {
    props: ["open"],
    emits: ["confirm", "hide", "update:open"],
    template: `<div v-if="open" data-testid="delete-modal"><button data-testid="modal-confirm" @click="$emit('confirm')" /></div>`,
  },
};

async function mountPage() {
  const w = mount(StudioPage, { global: { stubs }, attachTo: document.body });
  await flushPromises();
  return w;
}

beforeEach(() => {
  owners = [];
  h.notify.mockReset();
  h.confirm.mockReset();
  h.push.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, opts?: any) => {
    if (url === "/api/admin/decorations/list") return [entry];
    if (url === "/api/admin/decorations/halo/owners") return owners;
    if (opts?.method === "PUT") return { success: true, layers: opts.body.layers, deletedAssets: [] };
    return { success: true };
  });
});

describe("decoration studio page", () => {
  it("loads the decoration and starts clean", async () => {
    const w = await mountPage();
    expect(w.text()).toContain("Halo");
    expect(w.find('[data-testid="unsaved"]').exists()).toBe(false);
  });

  it("marks unsaved edits and saves them", async () => {
    const w = await mountPage();
    await w.find('[data-testid="rename"]').trigger("click");
    expect(w.find('[data-testid="unsaved"]').exists()).toBe(true);
    await w.find('[data-testid="save"]').trigger("click");
    await flushPromises();
    const put = fetchMock.mock.calls.find(([, o]) => o?.method === "PUT");
    expect(put?.[1].body.name).toBe("Halo 2");
    expect(h.notify).toHaveBeenCalledWith(expect.objectContaining({ color: "success" }));
    expect(w.find('[data-testid="unsaved"]').exists()).toBe(false);
  });

  it("saves on Ctrl+S", async () => {
    const w = await mountPage();
    await w.find('[data-testid="rename"]').trigger("click");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true }));
    await flushPromises();
    expect(fetchMock.mock.calls.some(([, o]) => o?.method === "PUT")).toBe(true);
  });

  it("deletes an unowned decoration after a plain confirm", async () => {
    h.confirm.mockResolvedValue(true);
    const w = await mountPage();
    await w.find('[data-testid="delete"]').trigger("click");
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/decorations/halo", { method: "DELETE" });
    expect(h.push).toHaveBeenCalledWith("/admin/decorations");
  });

  it("routes an owned decoration through the type-to-confirm modal and forces", async () => {
    owners = [{ userId: "u1", name: "Ann", avatarUrl: null, acquiredAt: "2026-01-01", source: "purchase" }];
    const w = await mountPage();
    await w.find('[data-testid="delete"]').trigger("click");
    expect(h.confirm).not.toHaveBeenCalled();
    await w.find('[data-testid="modal-confirm"]').trigger("click");
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/decorations/halo?force=1", { method: "DELETE" });
  });

  it("guards leaving only while there are unsaved changes", async () => {
    const w = await mountPage();
    expect(await h.leave.guard!()).toBe(true);
    await w.find('[data-testid="rename"]').trigger("click");
    h.confirm.mockResolvedValue(false);
    expect(await h.leave.guard!()).toBe(false);
    expect(h.confirm).toHaveBeenCalled();
  });
});
