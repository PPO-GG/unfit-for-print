/**
 * All state for one decoration in the studio. The stack lives in a
 * shallowRef that only ever receives new objects (see decorationStack.ts),
 * so the debounced history snapshots are cheap and a slider drag collapses
 * into one undo step.
 */
import { computed, ref, shallowRef } from "vue";
import { useDebouncedRefHistory } from "@vueuse/core";
import type { DecorationCatalogEntry } from "~/types/decoration";
import {
  assetFormatsFor, normalizeLayers,
  type AssetFormat, type AssetRef, type DecorationLayers, type LayerSide, type LayerType,
} from "#shared/decorationLayers";
import * as ops from "~/utils/decorationStack";

export interface DecorationOwner {
  userId: string;
  name: string;
  avatarUrl: string | null;
  acquiredAt: string;
  source: string;
}

const emptyListing = (): ops.ListingFields => ({
  name: "", description: "", rarity: "common", category: "custom", enabled: false,
  freeForAll: false, discordSkuId: "", price: 0, sortOrder: 999,
});

export function useDecorationStudio(id: string) {
  const { $activityFetch } = useNuxtApp();

  const loading = ref(true);
  const saving = ref(false);
  const deleted = ref(false);
  const error = ref<string | null>(null);
  const entry = ref<DecorationCatalogEntry | null>(null);
  const listing = ref<ops.ListingFields>(emptyListing());
  const stack = shallowRef<DecorationLayers>({ v: 1, layers: [] });
  const selectedId = ref<string | null>(null);
  const owners = ref<DecorationOwner[]>([]);

  const history = useDebouncedRefHistory(stack, { debounce: 300, capacity: 100 });

  const savedSnapshot = ref("");
  const snapshot = () => JSON.stringify({ listing: listing.value, stack: stack.value });
  const dirty = computed(() => !loading.value && !deleted.value && snapshot() !== savedSnapshot.value);
  const selected = computed(() => stack.value.layers.find((l) => l.id === selectedId.value) ?? null);

  function markClean() {
    // `history`'s baseline ("last") only advances on commit, so without an
    // explicit commit here it would still point at the empty stack the
    // composable was created with, and clear() alone doesn't touch it —
    // the next debounced commit would then diff against that stale empty
    // baseline instead of the freshly loaded/saved one. Commit captures the
    // current stack as the new baseline (and cancels the pending debounced
    // commit for the change that just landed), then clear() drops the
    // undo/redo stacks so we start clean.
    history.commit();
    history.clear();
    savedSnapshot.value = snapshot();
  }

  async function loadOwners() {
    owners.value = await $activityFetch<DecorationOwner[]>(`/api/admin/decorations/${id}/owners`);
  }

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const list = await $activityFetch<DecorationCatalogEntry[]>("/api/admin/decorations/list");
      const found = list.find((d) => d.decorationId === id);
      if (!found) {
        error.value = "Decoration not found";
        return;
      }
      entry.value = found;
      listing.value = {
        name: found.name,
        description: found.description,
        rarity: found.rarity,
        category: found.category,
        enabled: found.enabled,
        freeForAll: found.freeForAll,
        discordSkuId: found.discordSkuId ?? "",
        price: found.price,
        sortOrder: found.sortOrder,
      };
      stack.value = normalizeLayers(found.layers);
      selectedId.value = stack.value.layers.at(-1)?.id ?? null;
      markClean();
      await loadOwners();
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || "Failed to load decoration";
    } finally {
      loading.value = false;
    }
  }

  async function save() {
    saving.value = true;
    try {
      const result = await $activityFetch<{ layers: DecorationLayers }>(`/api/admin/decorations/${id}`, {
        method: "PUT",
        body: ops.buildSavePayload(listing.value, stack.value),
      });
      stack.value = result.layers; // the server's normalised copy is the new baseline
      markClean();
    } finally {
      saving.value = false;
    }
  }

  function addLayer(type: LayerType): string | null {
    const result = ops.addLayer(stack.value, type);
    if (result.id) {
      stack.value = result.stack;
      selectedId.value = result.id;
    }
    return result.id;
  }

  function removeLayer(layerId: string) {
    stack.value = ops.removeLayer(stack.value, layerId);
    if (selectedId.value === layerId) selectedId.value = stack.value.layers.at(-1)?.id ?? null;
  }

  function duplicateLayer(layerId: string) {
    const result = ops.duplicateLayer(stack.value, layerId);
    if (result.id) {
      stack.value = result.stack;
      selectedId.value = result.id;
    }
  }

  function updateLayer(layerId: string, patch: Record<string, unknown>) {
    stack.value = ops.updateLayer(stack.value, layerId, patch);
  }

  function moveLayer(layerId: string, side: LayerSide, topIndex: number) {
    stack.value = ops.moveLayer(stack.value, layerId, side, topIndex);
  }

  async function uploadAsset(file: File): Promise<AssetRef> {
    const form = new FormData();
    form.append("file", file);
    const result = await $activityFetch<{ fileId: string; imageFormat: AssetFormat }>(
      "/api/admin/decorations/upload",
      { method: "POST", body: form },
    );
    return { key: result.fileId, format: result.imageFormat };
  }

  function setLayerAsset(layerId: string, asset: AssetRef | null) {
    const layer = stack.value.layers.find((l) => l.id === layerId);
    if (!layer) return;
    if (asset && !assetFormatsFor(layer.type).includes(asset.format)) {
      throw new Error(`A ${layer.type} layer can't hold a ${asset.format} file`);
    }
    updateLayer(layerId, { asset });
  }

  async function grant(userId: string) {
    await $activityFetch("/api/admin/decorations/grant", { method: "POST", body: { userId, decorationId: id } });
    await loadOwners();
  }

  async function revoke(userId: string) {
    await $activityFetch("/api/admin/decorations/grant", { method: "DELETE", body: { userId, decorationId: id } });
    await loadOwners();
  }

  async function destroy(force: boolean) {
    await $activityFetch(`/api/admin/decorations/${id}${force ? "?force=1" : ""}`, { method: "DELETE" });
    deleted.value = true;
  }

  return {
    loading, saving, error, deleted, entry, listing, stack, selectedId, selected, owners, dirty,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo: history.undo,
    redo: history.redo,
    load, save, loadOwners,
    addLayer, removeLayer, duplicateLayer, updateLayer, moveLayer,
    uploadAsset, setLayerAsset,
    grant, revoke, destroy,
  };
}
