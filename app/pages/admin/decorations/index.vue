<script setup lang="ts">
/**
 * The decoration catalog: live tiles, filters, and the way into the studio.
 * Editing happens on /admin/decorations/[id]; this page only lists,
 * creates and cleans up.
 */
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import type { DecorationCatalogEntry } from "~/types/decoration";
import type { StarterId } from "#shared/decorationPresets";
import { useNotifications } from "~/composables/useNotifications";
import AdminDecoTile from "~/components/admin/AdminDecoTile.vue";
import AdminDecoNewModal from "~/components/admin/AdminDecoNewModal.vue";

definePageMeta({ middleware: "admin" });

const { $activityFetch } = useNuxtApp();
const router = useRouter();
const { notify } = useNotifications();

const catalog = ref<DecorationCatalogEntry[]>([]);
const loading = ref(true);
const fetchError = ref<string | null>(null);
const search = ref("");
const rarity = ref("all");
const status = ref<"all" | "live" | "hidden" | "free">("all");
const newOpen = ref(false);
const creating = ref(false);
const pruning = ref(false);

const errorText = (e: any) => e?.data?.statusMessage || e?.message || "Something went wrong";

async function fetchCatalog() {
  loading.value = true;
  fetchError.value = null;
  try {
    catalog.value = await $activityFetch<DecorationCatalogEntry[]>("/api/admin/decorations/list");
  } catch (e) {
    fetchError.value = errorText(e);
  } finally {
    loading.value = false;
  }
}

const stats = computed(() => ({
  total: catalog.value.length,
  live: catalog.value.filter((d) => d.enabled).length,
  free: catalog.value.filter((d) => d.freeForAll).length,
}));

const RARITY_ITEMS = ["all", "common", "rare", "epic", "legendary"].map((v) => ({ label: v, value: v }));
const STATUSES = ["all", "live", "hidden", "free"] as const;

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return catalog.value.filter((d) => {
    if (q && !`${d.name} ${d.decorationId}`.toLowerCase().includes(q)) return false;
    if (rarity.value !== "all" && d.rarity !== rarity.value) return false;
    if (status.value === "live" && !d.enabled) return false;
    if (status.value === "hidden" && d.enabled) return false;
    if (status.value === "free" && !d.freeForAll) return false;
    return true;
  });
});

async function create(payload: { name: string; slug?: string; starter?: StarterId; copyFrom?: string }) {
  creating.value = true;
  try {
    const created = await $activityFetch<{ decorationId: string }>("/api/admin/decorations", {
      method: "POST",
      body: payload,
    });
    newOpen.value = false;
    router.push(`/admin/decorations/${created.decorationId}`);
  } catch (e) {
    notify({ title: "Couldn't create decoration", description: errorText(e), color: "error" });
  } finally {
    creating.value = false;
  }
}

async function prune() {
  pruning.value = true;
  try {
    const result = await $activityFetch<{ scanned: number; deleted: number }>(
      "/api/admin/decorations/assets/prune",
      { method: "POST" },
    );
    notify({
      title: result.deleted ? `Deleted ${result.deleted} unused file${result.deleted === 1 ? "" : "s"}` : "No unused files",
      description: `Checked ${result.scanned} studio upload${result.scanned === 1 ? "" : "s"}.`,
      color: "success",
    });
  } catch (e) {
    notify({ title: "Couldn't clean up files", description: errorText(e), color: "error" });
  } finally {
    pruning.value = false;
  }
}

onMounted(fetchCatalog);
</script>

<template>
  <div class="mx-auto flex max-w-7xl flex-col gap-6 p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Decorations</h1>
        <p class="mt-1 text-slate-400">Avatar decorations: build the look, then list it</p>
      </div>
      <div class="flex gap-2">
        <UButton data-testid="catalog-prune" variant="ghost" color="neutral" icon="i-lucide-brush-cleaning" :loading="pruning" @click="prune">
          Clean up unused files
        </UButton>
        <UButton data-testid="catalog-new" icon="i-lucide-plus" @click="newOpen = true">New decoration</UButton>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <div data-testid="stat-total" class="rounded-lg bg-slate-900 p-4"><div class="text-xs uppercase text-slate-400">Total</div><div class="text-2xl font-bold">{{ stats.total }}</div></div>
      <div data-testid="stat-live" class="rounded-lg bg-slate-900 p-4"><div class="text-xs uppercase text-slate-400">Live</div><div class="text-2xl font-bold text-green-400">{{ stats.live }}</div></div>
      <div data-testid="stat-free" class="rounded-lg bg-slate-900 p-4"><div class="text-xs uppercase text-slate-400">Free</div><div class="text-2xl font-bold text-purple-400">{{ stats.free }}</div></div>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <UInput v-model="search" data-testid="catalog-search" icon="i-lucide-search" placeholder="Search name or id" class="w-64" />
      <USelect v-model="rarity" data-testid="catalog-rarity" :items="RARITY_ITEMS" class="w-40" />
      <div class="flex gap-1">
        <UButton
          v-for="s in STATUSES"
          :key="s"
          :data-testid="`status-${s}`"
          size="sm"
          :variant="status === s ? 'solid' : 'ghost'"
          color="neutral"
          @click="status = s"
        >{{ s }}</UButton>
      </div>
    </div>

    <div v-if="loading" class="py-16 text-center text-slate-400">Loading…</div>
    <p v-else-if="fetchError" class="py-16 text-center text-red-400">{{ fetchError }}</p>
    <div v-else-if="catalog.length === 0" class="flex flex-col items-center gap-3 py-16">
      <p class="text-lg font-semibold">Create your first decoration</p>
      <p class="text-slate-400">Stack glows, rings, particles and images into something players will want to wear.</p>
      <UButton icon="i-lucide-plus" @click="newOpen = true">New decoration</UButton>
    </div>
    <p v-else-if="filtered.length === 0" class="py-16 text-center text-slate-400">No decorations match these filters.</p>
    <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
      <AdminDecoTile v-for="d in filtered" :key="d.decorationId" :entry="d" />
    </div>

    <AdminDecoNewModal v-model:open="newOpen" :catalog="catalog" :creating="creating" @create="create" />
  </div>
</template>
