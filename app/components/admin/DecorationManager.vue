<script setup lang="ts">
import { decorationRegistry } from "~/utils/decorations";
import type { DecorationCatalogEntry } from "~/types/decoration";
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
  orphaned: catalog.value.filter((d) => !d.hasComponent).length,
}));

const rarityOptions = ["common", "rare", "epic", "legendary"];

const editForm = reactive({
  name: "",
  description: "",
  type: "",
  rarity: "",
  enabled: false,
  freeForAll: false,
  discordSkuId: "",
  price: 0,
  sortOrder: 999,
});

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
    fetchError.value = err.data?.statusMessage || err.message || "Failed to load catalog";
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
  editingDecoration.value = decoration;
  editForm.name = decoration.name;
  editForm.description = decoration.description;
  editForm.type = decoration.type;
  editForm.rarity = decoration.rarity;
  editForm.enabled = decoration.enabled;
  editForm.freeForAll = decoration.freeForAll;
  editForm.discordSkuId = decoration.discordSkuId || "";
  editForm.price = decoration.price;
  editForm.sortOrder = decoration.sortOrder;
  showEditModal.value = true;
}

async function saveEdit() {
  if (!editingDecoration.value) return;
  saving.value = true;
  try {
    await $fetch(`/api/admin/decorations/${editingDecoration.value.$id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: {
        name: editForm.name,
        description: editForm.description,
        type: editForm.type,
        rarity: editForm.rarity,
        enabled: editForm.enabled,
        freeForAll: editForm.freeForAll,
        discordSkuId: editForm.discordSkuId || null,
        price: editForm.price,
        sortOrder: editForm.sortOrder,
      },
    });
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
      body: { userId: grantUserId.value, decorationId: grantDecorationId.value },
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
      body: { userId: grantUserId.value, decorationId: grantDecorationId.value },
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
    case "legendary": return "text-amber-400";
    case "epic": return "text-purple-400";
    case "rare": return "text-blue-400";
    default: return "text-slate-400";
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
      <UButton
        icon="i-solar-refresh-bold-duotone"
        :loading="syncing"
        @click="syncRegistry"
      >
        Sync Registry
      </UButton>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <UCard>
        <div class="text-sm text-slate-400 uppercase tracking-wide">Total</div>
        <div class="text-2xl font-bold">{{ stats.total }}</div>
      </UCard>
      <UCard>
        <div class="text-sm text-slate-400 uppercase tracking-wide">Enabled</div>
        <div class="text-2xl font-bold text-green-400">{{ stats.enabled }}</div>
      </UCard>
      <UCard>
        <div class="text-sm text-slate-400 uppercase tracking-wide">Free</div>
        <div class="text-2xl font-bold text-purple-400">{{ stats.free }}</div>
      </UCard>
      <UCard>
        <div class="text-sm text-slate-400 uppercase tracking-wide">Orphaned</div>
        <div class="text-2xl font-bold text-amber-400">{{ stats.orphaned }}</div>
      </UCard>
    </div>

    <!-- Catalog Table -->
    <UCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold">Catalog</h2>
          <span class="text-sm text-slate-400">{{ catalog.length }} decorations</span>
        </div>
      </template>

      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-solar-refresh-bold-duotone" class="text-2xl animate-spin" />
      </div>

      <div v-else-if="fetchError" class="text-center py-8">
        <p class="text-red-400">{{ fetchError }}</p>
      </div>

      <div v-else-if="catalog.length === 0" class="text-center py-8">
        <p class="text-slate-400">No decorations in database. Click "Sync Registry" to populate.</p>
      </div>

      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700">
            <th class="pb-3 pl-2">Preview</th>
            <th class="pb-3">Name</th>
            <th class="pb-3">Type</th>
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
              <AvatarDecoration :decoration-id="decoration.decorationId">
                <UAvatar size="sm" />
              </AvatarDecoration>
            </td>
            <td class="py-3">
              <div class="font-semibold">{{ decoration.name }}</div>
              <div class="text-xs text-slate-500">{{ decoration.decorationId }}</div>
              <UBadge v-if="!decoration.hasComponent" color="warning" variant="subtle" size="xs" class="mt-1">
                Orphaned — no component
              </UBadge>
            </td>
            <td class="py-3 text-slate-400">{{ decoration.type }}</td>
            <td class="py-3">
              <span :class="rarityColor(decoration.rarity)">★ {{ decoration.rarity }}</span>
            </td>
            <td class="py-3 text-center">
              <UBadge :color="decoration.enabled ? 'success' : 'error'" variant="subtle" size="xs">
                {{ decoration.enabled ? "Enabled" : "Disabled" }}
              </UBadge>
            </td>
            <td class="py-3 text-center">
              <span v-if="decoration.freeForAll" class="text-purple-400 text-xs">✓ Free</span>
              <span v-else class="text-slate-600">—</span>
            </td>
            <td class="py-3">
              <code v-if="decoration.discordSkuId" class="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                {{ decoration.discordSkuId.slice(0, 8) }}…
              </code>
              <span v-else class="text-xs text-slate-600 italic">Not linked</span>
            </td>
            <td class="py-3 text-right">
              <span v-if="decoration.price > 0">${{ decoration.price.toFixed(2) }}</span>
              <span v-else class="text-slate-600">—</span>
            </td>
            <td class="py-3 text-right pr-2">
              <UButton size="xs" variant="soft" @click.stop="openEdit(decoration)">Edit</UButton>
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
          <label class="block text-xs uppercase text-slate-400 mb-1">User ID</label>
          <UInput v-model="grantUserId" placeholder="Appwrite user ID" size="sm" />
        </div>
        <div class="flex-1">
          <label class="block text-xs uppercase text-slate-400 mb-1">Decoration</label>
          <USelectMenu
            v-model="grantDecorationId"
            :items="catalog.map((d) => ({ label: d.name, value: d.decorationId }))"
            value-key="value"
            placeholder="Select decoration"
            size="sm"
          />
        </div>
        <UButton color="success" size="sm" :loading="granting" @click="grantDecoration">Grant</UButton>
        <UButton color="error" size="sm" :loading="granting" @click="revokeDecoration">Revoke</UButton>
      </div>
    </UCard>

    <!-- Edit Modal -->
    <UModal v-model:open="showEditModal">
      <template #content>
        <div v-if="editingDecoration" class="p-6 space-y-6">
          <h2 class="text-xl font-bold">Edit Decoration</h2>

          <!-- Large Preview -->
          <div class="bg-slate-900 rounded-xl p-8 flex flex-col items-center gap-3">
            <AvatarDecoration :decoration-id="editingDecoration.decorationId">
              <UAvatar size="3xl" />
            </AvatarDecoration>
            <div class="text-center">
              <div class="font-bold text-lg">{{ editForm.name }}</div>
              <div :class="rarityColor(editForm.rarity)" class="text-sm">
                ★ {{ editForm.rarity }} · {{ editForm.type }}
              </div>
              <div class="text-xs text-slate-500 mt-1">{{ editingDecoration.decorationId }}</div>
            </div>
          </div>

          <!-- Form -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase text-slate-400 mb-1">Name</label>
              <UInput v-model="editForm.name" size="sm" />
            </div>
            <div>
              <label class="block text-xs uppercase text-slate-400 mb-1">Rarity</label>
              <USelectMenu v-model="editForm.rarity" :items="rarityOptions" size="sm" />
            </div>
            <div class="col-span-2">
              <label class="block text-xs uppercase text-slate-400 mb-1">Description</label>
              <UTextarea v-model="editForm.description" :rows="2" size="sm" />
            </div>
            <div>
              <label class="block text-xs uppercase text-slate-400 mb-1">Type</label>
              <UInput v-model="editForm.type" placeholder="ring, aura, badge" size="sm" />
            </div>
            <div>
              <label class="block text-xs uppercase text-slate-400 mb-1">Sort Order</label>
              <UInput v-model.number="editForm.sortOrder" type="number" size="sm" />
            </div>

            <div class="col-span-2 border-t border-slate-700 pt-4 flex gap-4">
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

            <div class="col-span-2 border-t border-slate-700 pt-4 grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs uppercase text-slate-400 mb-1">Discord SKU ID</label>
                <UInput v-model="editForm.discordSkuId" placeholder="Paste SKU ID" size="sm" />
              </div>
              <div>
                <label class="block text-xs uppercase text-slate-400 mb-1">Price (display)</label>
                <UInput v-model.number="editForm.price" type="number" step="0.01" size="sm">
                  <template #leading>$</template>
                </UInput>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton variant="soft" @click="showEditModal = false">Cancel</UButton>
            <UButton :loading="saving" @click="saveEdit">Save Changes</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
