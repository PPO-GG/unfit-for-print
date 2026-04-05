<script setup lang="ts">
import { decorationRegistry } from "~/utils/decorations";
import type {
  DecorationCatalogEntry,
  AttachmentConfig,
  ImageFormat,
} from "~/types/decoration";
import { DEFAULT_ATTACHMENT_CONFIG } from "~/utils/decorationDefaults";
import { getDecorationImageUrl } from "~/utils/decorationImage";
import { useUserStore } from "~/stores/userStore";

const userStore = useUserStore();

const authHeaders = () => ({
  Authorization: `Bearer ${userStore.session?.$id}`,
  "x-appwrite-user-id": userStore.user?.$id ?? "",
});

// State
const catalog = ref<(DecorationCatalogEntry & { hasComponent: boolean })[]>([]);
const loading = ref(false);
const fetchError = ref<string | null>(null);
const syncing = ref(false);
const showEditModal = ref(false);
const editingDecoration = ref<DecorationCatalogEntry | null>(null);
const isCreating = ref(false);
const saving = ref(false);

// Grant/Revoke state
const grantUserId = ref("");
const grantDecorationId = ref("");
const granting = ref(false);

// Stats
const stats = computed(() => ({
  total: catalog.value.length,
  enabled: catalog.value.filter((d) => d.enabled).length,
  free: catalog.value.filter((d) => d.freeForAll).length,
  orphaned: catalog.value.filter(
    (d) => !d.hasComponent && d.type !== "attachment",
  ).length,
}));

const rarityOptions = ["common", "rare", "epic", "legendary"];
const typeOptions = ["effect", "attachment"];
const categoryOptions = ["hat", "face", "effect", "custom"];

const editForm = reactive({
  name: "",
  description: "",
  type: "effect" as string,
  rarity: "",
  category: "custom" as string,
  enabled: false,
  freeForAll: false,
  discordSkuId: "",
  price: 0,
  sortOrder: 999,
});

// ─── Attachment Editor State ───────────────────────────────────────
const attachmentForm = reactive<AttachmentConfig>({
  ...DEFAULT_ATTACHMENT_CONFIG,
});
const imageFileId = ref<string | null>(null);
const imageFormat = ref<ImageFormat | null>(null);
const uploading = ref(false);
const imageInputRef = ref<HTMLInputElement | null>(null);

const isAttachment = computed(() => editForm.type === "attachment");
const isLottieFormat = computed(
  () => imageFormat.value === "lottie" || imageFormat.value === "dotlottie",
);
const previewImageUrl = computed(() =>
  imageFileId.value ? getDecorationImageUrl(imageFileId.value) : null,
);

const anchorOptions = [
  { label: "Top Center", value: "top-center" },
  { label: "Top Left", value: "top-left" },
  { label: "Top Right", value: "top-right" },
  { label: "Center", value: "center" },
  { label: "Bottom Center", value: "bottom-center" },
];

async function uploadImage(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  uploading.value = true;
  try {
    const form = new FormData();
    form.append("file", file);
    const result = await $fetch<{ fileId: string; imageFormat: ImageFormat }>(
      "/api/admin/decorations/upload",
      { method: "POST", headers: authHeaders(), body: form },
    );
    imageFileId.value = result.fileId;
    imageFormat.value = result.imageFormat;
  } catch (err: any) {
    alert(`Upload failed: ${err.data?.statusMessage || err.message || err}`);
  }
  uploading.value = false;
  // Reset input so re-selecting the same file triggers change
  if (input) input.value = "";
}

async function removeImage() {
  if (!imageFileId.value) return;
  try {
    await $fetch(`/api/admin/decorations/upload/${imageFileId.value}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
  } catch {
    /* ignore — may already be deleted */
  }
  imageFileId.value = null;
  imageFormat.value = null;
}

function resetAttachment() {
  Object.assign(attachmentForm, DEFAULT_ATTACHMENT_CONFIG);
}

async function fetchCatalog() {
  loading.value = true;
  fetchError.value = null;
  try {
    const data = await $fetch<DecorationCatalogEntry[]>(
      "/api/admin/decorations/list",
      { headers: authHeaders() },
    );
    catalog.value = data.map((d) => ({
      ...d,
      hasComponent: d.decorationId in decorationRegistry,
    }));
  } catch (err: any) {
    console.error("Failed to fetch catalog:", err);
    fetchError.value =
      err.data?.statusMessage || err.message || "Failed to load catalog";
  }
  loading.value = false;
}

async function syncRegistry() {
  syncing.value = true;
  try {
    const registryKeys = Object.keys(decorationRegistry);
    const result = await $fetch<{
      created: string[];
      existing: string[];
      orphaned: string[];
    }>("/api/admin/decorations/sync", {
      method: "POST",
      headers: authHeaders(),
      body: { registryKeys },
    });
    await fetchCatalog();
    alert(
      `Sync complete: ${result.created.length} created, ${result.existing.length} existing, ${result.orphaned.length} orphaned`,
    );
  } catch (err: any) {
    alert(`Sync failed: ${err.message || err}`);
  }
  syncing.value = false;
}

function openEdit(decoration: DecorationCatalogEntry) {
  isCreating.value = false;
  editingDecoration.value = decoration;
  editForm.name = decoration.name;
  editForm.description = decoration.description;
  editForm.type = decoration.type || "effect";
  editForm.rarity = decoration.rarity;
  editForm.category = decoration.category || "custom";
  editForm.enabled = decoration.enabled;
  editForm.freeForAll = decoration.freeForAll;
  editForm.discordSkuId = decoration.discordSkuId || "";
  editForm.price = decoration.price;
  editForm.sortOrder = decoration.sortOrder;

  // Load attachment state
  imageFileId.value = decoration.imageFileId || null;
  imageFormat.value = decoration.imageFormat || null;
  if (decoration.attachment) {
    Object.assign(attachmentForm, decoration.attachment);
  } else {
    resetAttachment();
  }

  showEditModal.value = true;
}

function openCreate() {
  isCreating.value = true;
  editingDecoration.value = null;
  editForm.name = "New Attachment";
  editForm.description = "";
  editForm.type = "attachment";
  editForm.rarity = "common";
  editForm.category = "custom";
  editForm.enabled = false;
  editForm.freeForAll = false;
  editForm.discordSkuId = "";
  editForm.price = 0;
  editForm.sortOrder = 999;

  imageFileId.value = null;
  imageFormat.value = null;
  resetAttachment();

  showEditModal.value = true;
}

async function deleteDecoration() {
  if (!editingDecoration.value) return;
  if (!confirm(`Delete "${editingDecoration.value.name}"? This cannot be undone.`)) return;
  saving.value = true;
  try {
    await $fetch(`/api/admin/decorations/${editingDecoration.value.$id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    showEditModal.value = false;
    await fetchCatalog();
  } catch (err: any) {
    alert(`Delete failed: ${err.data?.statusMessage || err.message || err}`);
  }
  saving.value = false;
}

async function saveEdit() {
  if (!isCreating.value && !editingDecoration.value) return;
  saving.value = true;
  try {
    const body: Record<string, any> = {
      name: editForm.name,
      description: editForm.description,
      type: editForm.type,
      rarity: editForm.rarity,
      category: editForm.category,
      enabled: editForm.enabled,
      freeForAll: editForm.freeForAll,
      discordSkuId: editForm.discordSkuId || null,
      price: editForm.price,
      sortOrder: editForm.sortOrder,
    };

    // Include attachment data when type is 'attachment'
    if (editForm.type === "attachment") {
      body.imageFileId = imageFileId.value || null;
      body.attachment = JSON.stringify(attachmentForm);
      body.imageFormat = imageFormat.value || null;
    } else {
      body.imageFileId = null;
      body.attachment = null;
      body.imageFormat = null;
    }

    if (isCreating.value) {
      // Create new decoration
      await $fetch("/api/admin/decorations", {
        method: "POST",
        headers: authHeaders(),
        body,
      });
    } else {
      // Update existing decoration
      await $fetch(`/api/admin/decorations/${editingDecoration.value!.$id}`, {
        method: "PUT",
        headers: authHeaders(),
        body,
      });
    }

    showEditModal.value = false;
    await fetchCatalog();
  } catch (err: any) {
    alert(`Save failed: ${err.data?.statusMessage || err.message || err}`);
  }
  saving.value = false;
}

async function grantDecoration() {
  if (!grantUserId.value || !grantDecorationId.value) return;
  granting.value = true;
  try {
    await $fetch("/api/admin/decorations/grant", {
      method: "POST",
      headers: authHeaders(),
      body: {
        userId: grantUserId.value,
        decorationId: grantDecorationId.value,
      },
    });
    alert("Decoration granted!");
    grantUserId.value = "";
    grantDecorationId.value = "";
  } catch (err: any) {
    alert(`Grant failed: ${err.data?.statusMessage || err.message || err}`);
  }
  granting.value = false;
}

async function revokeDecoration() {
  if (!grantUserId.value || !grantDecorationId.value) return;
  granting.value = true;
  try {
    await $fetch("/api/admin/decorations/grant", {
      method: "DELETE",
      headers: authHeaders(),
      body: {
        userId: grantUserId.value,
        decorationId: grantDecorationId.value,
      },
    });
    alert("Decoration revoked!");
    grantUserId.value = "";
    grantDecorationId.value = "";
  } catch (err: any) {
    alert(`Revoke failed: ${err.data?.statusMessage || err.message || err}`);
  }
  granting.value = false;
}

function rarityColor(rarity: string) {
  switch (rarity) {
    case "legendary":
      return "text-amber-400";
    case "epic":
      return "text-purple-400";
    case "rare":
      return "text-blue-400";
    default:
      return "text-slate-400";
  }
}

onMounted(fetchCatalog);
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-bold">Decorations</h1>
        <p class="text-gray-400 mt-1">
          Manage avatar decorations, pricing, and ownership
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          icon="i-solar-add-circle-bold-duotone"
          color="primary"
          @click="openCreate"
        >
          New Attachment
        </UButton>
        <UButton
          icon="i-solar-refresh-bold-duotone"
          variant="soft"
          :loading="syncing"
          @click="syncRegistry"
        >
          Sync Registry
        </UButton>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <UCard>
        <div class="text-sm text-slate-400 uppercase tracking-wide">Total</div>
        <div class="text-2xl font-bold">{{ stats.total }}</div>
      </UCard>
      <UCard>
        <div class="text-sm text-slate-400 uppercase tracking-wide">
          Enabled
        </div>
        <div class="text-2xl font-bold text-green-400">{{ stats.enabled }}</div>
      </UCard>
      <UCard>
        <div class="text-sm text-slate-400 uppercase tracking-wide">Free</div>
        <div class="text-2xl font-bold text-purple-400">{{ stats.free }}</div>
      </UCard>
      <UCard>
        <div class="text-sm text-slate-400 uppercase tracking-wide">
          Orphaned
        </div>
        <div class="text-2xl font-bold text-amber-400">
          {{ stats.orphaned }}
        </div>
      </UCard>
    </div>

    <!-- Catalog Table -->
    <UCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold">Catalog</h2>
          <span class="text-sm text-slate-400"
            >{{ catalog.length }} decorations</span
          >
        </div>
      </template>

      <div v-if="loading" class="flex justify-center py-8">
        <UIcon
          name="i-solar-refresh-bold-duotone"
          class="text-2xl animate-spin"
        />
      </div>

      <div v-else-if="fetchError" class="text-center py-8">
        <p class="text-red-400">{{ fetchError }}</p>
      </div>

      <div v-else-if="catalog.length === 0" class="text-center py-8">
        <p class="text-slate-400">
          No decorations in database. Click "Sync Registry" to populate.
        </p>
      </div>

      <table v-else class="w-full text-sm">
        <thead>
          <tr
            class="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700"
          >
            <th class="pb-3 pl-2">Preview</th>
            <th class="pb-3">Name</th>
            <th class="pb-3">Type</th>
            <th class="pb-3">Category</th>
            <th class="pb-3">Rarity</th>
            <th class="pb-3 text-center">Status</th>
            <th class="pb-3 text-center">Free</th>
            <th class="pb-3">SKU</th>
            <th class="pb-3 text-right">Price</th>
            <th class="pb-3 text-right pr-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="decoration in catalog"
            :key="decoration.$id"
            class="border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer"
            :class="{ 'opacity-50': !decoration.enabled }"
            @click="openEdit(decoration)"
          >
            <td class="py-3 pl-2">
              <AvatarDecoration
                :decoration-id="decoration.decorationId"
                :catalog-entry="decoration"
              >
                <UAvatar size="md" />
              </AvatarDecoration>
            </td>
            <td class="py-3">
              <div class="font-semibold">{{ decoration.name }}</div>
              <div class="text-xs text-slate-500">
                {{ decoration.decorationId }}
              </div>
              <UBadge
                v-if="!decoration.hasComponent && decoration.type !== 'attachment'"
                color="warning"
                variant="subtle"
                size="xs"
                class="mt-1"
              >
                Orphaned — no component
              </UBadge>
            </td>
            <td class="py-3 text-slate-400">{{ decoration.type }}</td>
            <td class="py-3 text-slate-400">
              {{ decoration.category || "—" }}
            </td>
            <td class="py-3">
              <span :class="rarityColor(decoration.rarity)"
                >★ {{ decoration.rarity }}</span
              >
            </td>
            <td class="py-3 text-center">
              <UBadge
                :color="decoration.enabled ? 'success' : 'error'"
                variant="subtle"
                size="xs"
              >
                {{ decoration.enabled ? "Enabled" : "Disabled" }}
              </UBadge>
            </td>
            <td class="py-3 text-center">
              <span v-if="decoration.freeForAll" class="text-purple-400 text-xs"
                >✓ Free</span
              >
              <span v-else class="text-slate-600">—</span>
            </td>
            <td class="py-3">
              <code
                v-if="decoration.discordSkuId"
                class="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400"
              >
                {{ decoration.discordSkuId.slice(0, 8) }}…
              </code>
              <span v-else class="text-xs text-slate-600 italic"
                >Not linked</span
              >
            </td>
            <td class="py-3 text-right">
              <span v-if="decoration.price > 0"
                >${{ decoration.price.toFixed(2) }}</span
              >
              <span v-else class="text-slate-600">—</span>
            </td>
            <td class="py-3 text-right pr-2">
              <UButton
                size="xs"
                variant="soft"
                @click.stop="openEdit(decoration)"
                >Edit</UButton
              >
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <!-- Grant / Revoke -->
    <UCard>
      <template #header>
        <h2 class="text-xl font-semibold">Grant / Revoke</h2>
      </template>
      <div class="flex flex-col sm:flex-row gap-3 items-end">
        <div class="flex-1">
          <label class="block text-xs uppercase text-slate-400 mb-1"
            >User ID</label
          >
          <UInput
            v-model="grantUserId"
            placeholder="Appwrite user ID"
            size="md"
          />
        </div>
        <div class="flex-1">
          <label class="block text-xs uppercase text-slate-400 mb-1"
            >Decoration</label
          >
          <USelectMenu
            v-model="grantDecorationId"
            :items="
              catalog.map((d) => ({ label: d.name, value: d.decorationId }))
            "
            value-key="value"
            placeholder="Select decoration"
            size="md"
          />
        </div>
        <UButton
          color="success"
          size="md"
          :loading="granting"
          @click="grantDecoration"
          >Grant</UButton
        >
        <UButton
          color="error"
          size="md"
          :loading="granting"
          @click="revokeDecoration"
          >Revoke</UButton
        >
      </div>
    </UCard>

    <!-- Edit Modal -->
    <UModal v-model:open="showEditModal" class="sm:max-w-5xl">
      <template #content>
        <div
          v-if="editingDecoration || isCreating"
          class="p-6 max-h-[90vh] overflow-y-auto"
        >
          <h2 class="text-xl font-bold mb-6">
            {{ isCreating ? "Create Decoration" : "Edit Decoration" }}
          </h2>

          <div class="flex gap-6">
            <!-- LEFT: Info -->
            <div class="flex-1 min-w-0 space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs uppercase text-slate-400 mb-1">Name</label>
                  <UInput v-model="editForm.name" size="md" />
                </div>
                <div>
                  <label class="block text-xs uppercase text-slate-400 mb-1">Rarity</label>
                  <USelectMenu v-model="editForm.rarity" :items="rarityOptions" size="md" />
                </div>
                <div>
                  <label class="block text-xs uppercase text-slate-400 mb-1">Category</label>
                  <USelectMenu
                    v-model="editForm.category"
                    :items="categoryOptions"
                    placeholder="Category"
                    size="md"
                  />
                </div>
                <div>
                  <label class="block text-xs uppercase text-slate-400 mb-1">Type</label>
                  <USelectMenu v-model="editForm.type" :items="typeOptions" size="md" />
                </div>
                <div class="col-span-2">
                  <label class="block text-xs uppercase text-slate-400 mb-1">Description</label>
                  <UTextarea v-model="editForm.description" :rows="4" size="md" class="w-full" />
                </div>
                <div>
                  <label class="block text-xs uppercase text-slate-400 mb-1">Sort Order</label>
                  <UInput v-model.number="editForm.sortOrder" type="number" size="md" />
                </div>
              </div>

              <div class="border-t border-slate-700 pt-4 flex gap-4">
                <div class="flex items-center gap-3 flex-1">
                  <USwitch v-model="editForm.enabled" />
                  <div>
                    <div class="text-sm font-medium">Enabled</div>
                    <div class="text-xs text-slate-500">Visible to users</div>
                  </div>
                </div>
                <div class="flex items-center gap-3 flex-1">
                  <USwitch v-model="editForm.freeForAll" />
                  <div>
                    <div class="text-sm font-medium">Free for All</div>
                    <div class="text-xs text-slate-500">No purchase needed</div>
                  </div>
                </div>
              </div>

              <div class="border-t border-slate-700 pt-4 grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs uppercase text-slate-400 mb-1">Discord SKU ID</label>
                  <UInput v-model="editForm.discordSkuId" placeholder="Paste SKU ID" size="md" />
                </div>
                <div>
                  <label class="block text-xs uppercase text-slate-400 mb-1">Price (display)</label>
                  <UInput v-model.number="editForm.price" type="number" step="0.01" size="md">
                    <template #leading>$</template>
                  </UInput>
                </div>
              </div>
            </div>

            <!-- RIGHT: Preview + Attachment Editor -->
            <div class="w-72 flex-shrink-0 space-y-4">
              <!-- Large Preview -->
              <div class="bg-slate-900 rounded-xl p-6 flex flex-col items-center gap-3">
                <!-- Bespoke effect preview -->
                <AvatarDecoration
                  v-if="editForm.type !== 'attachment'"
                  :decoration-id="editingDecoration?.decorationId"
                >
                  <UAvatar class="size-32" />
                </AvatarDecoration>

                <!-- Live attachment preview -->
                <template v-else-if="previewImageUrl">
                  <AvatarLottie
                    v-if="isLottieFormat"
                    :image-url="previewImageUrl"
                    :attachment="attachmentForm"
                  >
                    <UAvatar class="size-32" />
                  </AvatarLottie>
                  <AvatarAttachment
                    v-else
                    :image-url="previewImageUrl"
                    :attachment="attachmentForm"
                  >
                    <UAvatar class="size-32" />
                  </AvatarAttachment>
                </template>

                <!-- No image yet -->
                <UAvatar v-else class="size-32" />

                <div class="text-center">
                  <div class="font-bold text-lg">{{ editForm.name }}</div>
                  <div
                    :class="rarityColor(editForm.rarity)"
                    class="text-sm flex items-center gap-1 justify-center"
                  >
                    ★ {{ editForm.rarity }} · {{ editForm.type }}
                    <UIcon
                      v-if="editForm.category"
                      :name="categoryIcon(editForm.category)"
                      class="text-slate-400"
                    />
                  </div>
                  <div class="text-xs text-slate-500 mt-1">
                    {{ editingDecoration?.decorationId ?? "New" }}
                  </div>
                </div>
              </div>

              <!-- Attachment Controls (only when type === 'attachment') -->
              <div v-if="isAttachment" class="space-y-4">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-400">
                    Attachment Settings
                  </h3>
                  <UButton size="xs" variant="ghost" color="neutral" @click="resetAttachment">
                    Reset
                  </UButton>
                </div>

                <!-- Image Upload -->
                <div>
                  <label class="block text-xs uppercase text-slate-400 mb-1">Image</label>
                  <input
                    ref="imageInputRef"
                    type="file"
                    accept="image/png, image/webp, application/json, .json, .lottie"
                    class="hidden"
                    @change="uploadImage"
                  />
                  <div v-if="previewImageUrl" class="space-y-2">
                    <div class="flex items-center gap-2">
                      <div class="w-10 h-10 rounded bg-slate-800 overflow-hidden flex-shrink-0">
                        <AvatarLottie
                          v-if="isLottieFormat"
                          :image-url="previewImageUrl"
                          :attachment="{ anchor: 'center', offsetX: 0, offsetY: 0, scale: 1, rotation: 0, zLayer: 'above', clipped: false }"
                        >
                          <div class="w-10 h-10" />
                        </AvatarLottie>
                        <img v-else :src="previewImageUrl" class="w-full h-full object-contain p-1" />
                      </div>
                      <span class="text-xs text-slate-400 truncate flex-1">{{ imageFileId }}</span>
                      <UBadge v-if="isLottieFormat" size="xs" color="info" variant="subtle">
                        {{ imageFormat }}
                      </UBadge>
                    </div>
                    <div class="flex gap-2 justify-end">
                      <UButton size="xs" variant="soft" :loading="uploading" @click="imageInputRef?.click()">Replace</UButton>
                      <UButton size="xs" color="error" variant="ghost" @click="removeImage">Remove</UButton>
                    </div>
                  </div>
                  <div v-else class="flex items-center gap-2">
                    <span class="text-xs text-slate-500 italic flex-1">No image uploaded</span>
                    <UButton size="sm" variant="soft" :loading="uploading" @click="imageInputRef?.click()">
                      Upload
                    </UButton>
                  </div>
                </div>

                <!-- Anchor -->
                <div>
                  <label class="block text-xs uppercase text-slate-400 mb-1">Anchor</label>
                  <USelectMenu
                    v-model="attachmentForm.anchor"
                    :items="anchorOptions"
                    value-key="value"
                    size="md"
                  />
                </div>

                <!-- Offset X -->
                <div>
                  <label class="block text-xs uppercase text-slate-400 mb-1">
                    Offset X: {{ attachmentForm.offsetX.toFixed(2) }}
                  </label>
                  <input
                    v-model.number="attachmentForm.offsetX"
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    class="w-full accent-indigo-500"
                  />
                </div>

                <!-- Offset Y -->
                <div>
                  <label class="block text-xs uppercase text-slate-400 mb-1">
                    Offset Y: {{ attachmentForm.offsetY.toFixed(2) }}
                  </label>
                  <input
                    v-model.number="attachmentForm.offsetY"
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    class="w-full accent-indigo-500"
                  />
                </div>

                <!-- Scale -->
                <div>
                  <label class="block text-xs uppercase text-slate-400 mb-1">
                    Scale: {{ attachmentForm.scale.toFixed(2) }}
                  </label>
                  <input
                    v-model.number="attachmentForm.scale"
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.05"
                    class="w-full accent-indigo-500"
                  />
                </div>

                <!-- Rotation -->
                <div>
                  <label class="block text-xs uppercase text-slate-400 mb-1">
                    Rotation: {{ attachmentForm.rotation }}°
                  </label>
                  <input
                    v-model.number="attachmentForm.rotation"
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    class="w-full accent-indigo-500"
                  />
                </div>

                <!-- Z-Layer -->
                <div class="flex items-center gap-4">
                  <label class="text-xs uppercase text-slate-400">Layer</label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="above" v-model="attachmentForm.zLayer" class="accent-indigo-500" />
                    <span class="text-sm">Above</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="below" v-model="attachmentForm.zLayer" class="accent-indigo-500" />
                    <span class="text-sm">Below</span>
                  </label>
                </div>

                <!-- Clipped (Inset) -->
                <div class="flex items-center gap-3">
                  <USwitch v-model="attachmentForm.clipped" />
                  <div>
                    <div class="text-sm font-medium">Clipped (Inset)</div>
                    <div class="text-xs text-slate-500">Mask to the avatar circle</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-between pt-6 mt-2 border-t border-slate-700">
            <UButton
              v-if="!isCreating"
              color="error"
              variant="ghost"
              :loading="saving"
              @click="deleteDecoration"
            >
              Delete
            </UButton>
            <div class="flex gap-2 ml-auto">
              <UButton variant="soft" @click="showEditModal = false">Cancel</UButton>
              <UButton :loading="saving" @click="saveEdit">{{
                isCreating ? "Create" : "Save Changes"
              }}</UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
