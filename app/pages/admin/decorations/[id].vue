<script setup lang="ts">
/**
 * The studio. It orchestrates only: all state and rules live in
 * useDecorationStudio and the AdminDeco* components.
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { isTransformable } from "#shared/decorationLayers";
import { nudgeTransform } from "~/utils/decorationStageMath";
import { useDecorationStudio } from "~/composables/useDecorationStudio";
import { useNotifications } from "~/composables/useNotifications";
import { useConfirm } from "~/composables/useConfirm";
import AdminDecoLayerList from "~/components/admin/AdminDecoLayerList.vue";
import AdminDecoInspector from "~/components/admin/AdminDecoInspector.vue";
import AdminDecoStage from "~/components/admin/AdminDecoStage.vue";
import AdminDecoContextStrip from "~/components/admin/AdminDecoContextStrip.vue";
import AdminDecoListing from "~/components/admin/AdminDecoListing.vue";
import AdminDecoOwners from "~/components/admin/AdminDecoOwners.vue";
import AdminDecoDeleteModal from "~/components/admin/AdminDecoDeleteModal.vue";

definePageMeta({ middleware: "admin" });

const route = useRoute();
const router = useRouter();
const id = String(route.params.id);

const studio = useDecorationStudio(id);
const {
  loading, error, saving, listing, stack, selectedId, selected, owners, dirty, canUndo, canRedo, undo, redo,
} = studio;
const { notify } = useNotifications();
const { confirm } = useConfirm();

const tab = ref("look");
const background = ref<"dark" | "light" | "checker">("dark");
const sample = ref<"photo" | "initials">("photo");
const uploading = ref(false);
const deleteOpen = ref(false);

const tabs = computed(() => [
  { label: "Look", value: "look", slot: "look" },
  { label: "Listing", value: "listing", slot: "listing" },
  { label: `Owners · ${owners.value.length}`, value: "owners", slot: "owners" },
]);

const errorText = (e: any) => e?.data?.statusMessage || e?.message || "Something went wrong";

async function save() {
  try {
    await studio.save();
    notify({ title: "Saved", color: "success" });
  } catch (e) {
    notify({ title: "Couldn't save", description: errorText(e), color: "error" });
  }
}

async function onUpload(file: File) {
  const layerId = selectedId.value;
  if (!layerId) return;
  uploading.value = true;
  try {
    studio.setLayerAsset(layerId, await studio.uploadAsset(file));
  } catch (e) {
    notify({ title: "Upload failed", description: errorText(e), color: "error" });
  } finally {
    uploading.value = false;
  }
}

function toggleVisible(layerId: string) {
  const layer = stack.value.layers.find((l) => l.id === layerId);
  if (layer) studio.updateLayer(layerId, { visible: !layer.visible });
}

async function doDelete(force: boolean) {
  try {
    await studio.destroy(force);
    notify({ title: "Decoration deleted", color: "success" });
    router.push("/admin/decorations");
  } catch (e) {
    notify({ title: "Couldn't delete", description: errorText(e), color: "error" });
  }
}

async function onDelete() {
  if (owners.value.length > 0) {
    deleteOpen.value = true;
    return;
  }
  const ok = await confirm({
    title: "Delete decoration?",
    message: `"${listing.value.name}" will be permanently deleted.`,
    confirmButtonText: "Delete",
    confirmButtonColor: "error",
  });
  if (ok) await doDelete(false);
}

async function hideInstead() {
  deleteOpen.value = false;
  listing.value = { ...listing.value, enabled: false };
  await save();
}

async function grant(userId: string) {
  try {
    await studio.grant(userId);
    notify({ title: "Granted", color: "success" });
  } catch (e) {
    notify({ title: "Couldn't grant", description: errorText(e), color: "error" });
  }
}

async function revoke(userId: string) {
  const ok = await confirm({
    title: "Revoke decoration?",
    message: "They'll lose it immediately, even if they bought it.",
    confirmButtonText: "Revoke",
    confirmButtonColor: "error",
  });
  if (!ok) return;
  try {
    await studio.revoke(userId);
  } catch (e) {
    notify({ title: "Couldn't revoke", description: errorText(e), color: "error" });
  }
}

function onKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === "z") {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  } else if (mod && key === "y") {
    e.preventDefault();
    redo();
  } else if (mod && key === "s") {
    e.preventDefault();
    if (dirty.value) save();
  } else if (tab.value === "look" && selected.value && isTransformable(selected.value)) {
    const next = nudgeTransform(selected.value.transform, e.key, e.shiftKey);
    if (next) {
      e.preventDefault();
      studio.updateLayer(selected.value.id, { transform: next });
    }
  }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return;
  e.preventDefault();
  e.returnValue = "";
}

onMounted(() => {
  studio.load();
  window.addEventListener("keydown", onKey);
  window.addEventListener("beforeunload", onBeforeUnload);
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("beforeunload", onBeforeUnload);
});

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true;
  return await confirm({
    title: "Discard unsaved changes?",
    message: "You have edits that haven't been saved.",
    confirmButtonText: "Discard",
    confirmButtonColor: "error",
  });
});
</script>

<template>
  <div class="mx-auto flex min-w-[1100px] max-w-7xl flex-col gap-4 p-6">
    <div v-if="loading" class="py-16 text-center text-slate-400">Loading…</div>

    <div v-else-if="error" class="py-16 text-center">
      <p class="text-red-400">{{ error }}</p>
      <NuxtLink to="/admin/decorations" class="text-primary-400 underline">Back to decorations</NuxtLink>
    </div>

    <template v-else>
      <div class="flex items-center gap-3">
        <UButton to="/admin/decorations" icon="i-lucide-arrow-left" variant="ghost" color="neutral" aria-label="Back to decorations" />
        <h1 class="text-2xl font-bold">{{ listing.name || "Untitled" }}</h1>
        <UBadge :color="listing.enabled ? 'success' : 'neutral'" variant="subtle">{{ listing.enabled ? "Live" : "Hidden" }}</UBadge>
        <span v-if="dirty" data-testid="unsaved" class="text-sm text-amber-400">Unsaved changes</span>
        <div class="ml-auto flex items-center gap-2">
          <UButton data-testid="undo" icon="i-lucide-undo-2" variant="ghost" color="neutral" aria-label="Undo" :disabled="!canUndo" @click="undo()" />
          <UButton data-testid="redo" icon="i-lucide-redo-2" variant="ghost" color="neutral" aria-label="Redo" :disabled="!canRedo" @click="redo()" />
          <UButton data-testid="delete" icon="i-lucide-trash-2" variant="ghost" color="error" @click="onDelete">Delete</UButton>
          <UButton data-testid="save" :loading="saving" :disabled="!dirty" @click="save">Save</UButton>
        </div>
      </div>

      <UTabs v-model="tab" :items="tabs" variant="link">
        <template #look>
          <div class="grid grid-cols-[240px_minmax(0,1fr)_300px] gap-4 pt-4">
            <AdminDecoLayerList
              :stack="stack"
              :selected-id="selectedId"
              @select="selectedId = $event"
              @add="studio.addLayer"
              @remove="studio.removeLayer"
              @duplicate="studio.duplicateLayer"
              @move="studio.moveLayer"
              @toggle-visible="toggleVisible"
              @rename="(layerId, name) => studio.updateLayer(layerId, { name })"
            />
            <div class="flex flex-col items-center gap-3">
              <AdminDecoContextStrip :stack="stack" :sample="sample" />
              <AdminDecoStage
                :stack="stack"
                :selected-id="selectedId"
                :background="background"
                :sample="sample"
                @select="selectedId = $event"
                @update="studio.updateLayer"
              />
              <div class="flex gap-6 text-xs text-slate-400">
                <span class="flex gap-1">Background:
                  <button v-for="b in (['dark', 'light', 'checker'] as const)" :key="b" :class="{ 'text-primary-400': background === b }" @click="background = b">{{ b }}</button>
                </span>
                <span class="flex gap-1">Avatar:
                  <button v-for="s in (['photo', 'initials'] as const)" :key="s" :class="{ 'text-primary-400': sample === s }" @click="sample = s">{{ s }}</button>
                </span>
                <span>Drag to move · corner to scale · dot to rotate · arrows nudge (Shift ×10)</span>
              </div>
            </div>
            <AdminDecoInspector
              :layer="selected"
              :uploading="uploading"
              @update="(patch) => selectedId && studio.updateLayer(selectedId, patch)"
              @upload="onUpload"
            />
          </div>
        </template>
        <template #listing>
          <div class="pt-4">
            <AdminDecoListing v-model="listing" :stack="stack" :decoration-id="id" :sample="sample" />
          </div>
        </template>
        <template #owners>
          <div class="pt-4">
            <AdminDecoOwners :owners="owners" @grant="grant" @revoke="revoke" />
          </div>
        </template>
      </UTabs>

      <AdminDecoDeleteModal
        v-model:open="deleteOpen"
        :name="listing.name"
        :owner-count="owners.length"
        @hide="hideInstead"
        @confirm="doDelete(true)"
      />
    </template>
  </div>
</template>
