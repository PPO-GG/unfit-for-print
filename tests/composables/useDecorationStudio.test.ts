import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nextTick } from "vue";
import { normalizeLayers } from "#shared/decorationLayers";

const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));

import { useDecorationStudio } from "~/composables/useDecorationStudio";

const entry = {
  $id: "halo", decorationId: "halo", name: "Halo", description: "", type: "layered",
  rarity: "rare", category: "effect", enabled: true, freeForAll: false, discordSkuId: null,
  price: 2, sortOrder: 5, imageFileId: null, imageFormat: null, attachment: null,
  layers: normalizeLayers({ v: 1, layers: [{ type: "ring", id: "r" }] }),
};

function route(url: string, opts?: { method?: string; body?: any }) {
  if (url === "/api/admin/decorations/list") return [entry];
  if (url === "/api/admin/decorations/halo/owners") return [{ userId: "u1", name: "Ann", avatarUrl: null, acquiredAt: "2026-01-01", source: "purchase" }];
  if (url === "/api/admin/decorations/halo" && opts?.method === "PUT") return { success: true, layers: normalizeLayers(opts.body.layers), deletedAssets: [] };
  if (url === "/api/admin/decorations/upload") return { fileId: "deco-1-hat.png", imageFormat: "png" };
  return { success: true };
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, opts?: any) => route(url, opts));
});
afterEach(() => vi.useRealTimers());

async function loaded() {
  const studio = useDecorationStudio("halo");
  await studio.load();
  return studio;
}

describe("useDecorationStudio", () => {
  it("loads listing, stack and owners, and starts clean", async () => {
    const s = await loaded();
    expect(s.listing.value.name).toBe("Halo");
    expect(s.listing.value.discordSkuId).toBe("");
    expect(s.stack.value.layers.map((l) => l.id)).toEqual(["r"]);
    expect(s.selectedId.value).toBe("r");
    expect(s.owners.value).toHaveLength(1);
    expect(s.dirty.value).toBe(false);
  });

  it("keeps the studio usable when the owners fetch fails", async () => {
    fetchMock.mockImplementation(async (url: string, opts?: any) => {
      if (url === "/api/admin/decorations/halo/owners") throw new Error("owners endpoint down");
      return route(url, opts);
    });
    const s = await loaded();
    expect(s.error.value).toBeNull();
    expect(s.listing.value.name).toBe("Halo");
    expect(s.stack.value.layers.map((l) => l.id)).toEqual(["r"]);
    expect(s.owners.value).toEqual([]);
  });

  it("reports an unknown id instead of throwing", async () => {
    const s = useDecorationStudio("missing");
    await s.load();
    expect(s.error.value).toMatch(/not found/i);
  });

  it("goes dirty on edit and clean again after save, sending the normalised payload", async () => {
    const s = await loaded();
    s.updateLayer("r", { thickness: 0.1 });
    s.listing.value.name = "Halo 2";
    expect(s.dirty.value).toBe(true);
    await s.save();
    const put = fetchMock.mock.calls.find(([, o]) => o?.method === "PUT")!;
    expect(put[1].body).toMatchObject({ name: "Halo 2", discordSkuId: null });
    expect(put[1].body.layers.layers[0].thickness).toBe(0.1);
    expect(s.dirty.value).toBe(false);
  });

  it("adds, selects, duplicates and removes layers", async () => {
    const s = await loaded();
    const id = s.addLayer("glow")!;
    expect(s.selectedId.value).toBe(id);
    s.duplicateLayer(id);
    expect(s.stack.value.layers).toHaveLength(3);
    s.removeLayer(s.selectedId.value!);
    expect(s.stack.value.layers).toHaveLength(2);
  });

  it("undoes and redoes after the debounce window", async () => {
    const s = await loaded();
    s.updateLayer("r", { thickness: 0.2 });
    await nextTick();
    vi.advanceTimersByTime(400);
    expect(s.canUndo.value).toBe(true);
    s.undo();
    expect((s.stack.value.layers[0] as { thickness: number }).thickness).toBe(0.03);
    s.redo();
    expect((s.stack.value.layers[0] as { thickness: number }).thickness).toBe(0.2);
  });

  it("uploads an asset and refuses a format the layer can't hold", async () => {
    const s = await loaded();
    const imageId = s.addLayer("image")!;
    const asset = await s.uploadAsset(new File(["x"], "hat.png", { type: "image/png" }));
    s.setLayerAsset(imageId, asset);
    expect(s.selected.value).toMatchObject({ asset: { key: "deco-1-hat.png", format: "png" } });

    const lottieId = s.addLayer("lottie")!;
    expect(() => s.setLayerAsset(lottieId, asset)).toThrow(/can't hold/i);
  });

  it("marks itself deleted so the leave guard stays quiet", async () => {
    const s = await loaded();
    s.listing.value.name = "changed";
    await s.destroy(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/decorations/halo?force=1", { method: "DELETE" });
    expect(s.deleted.value).toBe(true);
    expect(s.dirty.value).toBe(false);
  });
});
