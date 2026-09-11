<script setup lang="ts">
/**
 * Store and catalog metadata, kept apart from the look. The two previews
 * mirror the owned and locked tiles on profile.vue, so the listing can be
 * checked the way players will meet it.
 */
import type { DecorationLayers } from "#shared/decorationLayers";
import type { ListingFields } from "~/utils/decorationStack";
import { categoryIcon, rarityColorClass, rarityPips } from "~/utils/decorationDisplay";
import DecorationStack from "~/components/decorations/DecorationStack.vue";
import AdminDecoSampleAvatar from "./AdminDecoSampleAvatar.vue";

const listing = defineModel<ListingFields>({ required: true });
defineProps<{ stack: DecorationLayers; decorationId: string; sample: "photo" | "initials" }>();

const RARITIES = ["common", "rare", "epic", "legendary"].map((v) => ({ label: v, value: v }));
const CATEGORIES = ["hat", "face", "effect", "custom"].map((v) => ({ label: v, value: v }));

function set<K extends keyof ListingFields>(key: K, value: ListingFields[K]) {
  listing.value = { ...listing.value, [key]: value };
}
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1fr)_320px] gap-8">
    <div class="grid grid-cols-2 gap-4">
      <label class="col-span-2 flex flex-col gap-1 text-xs text-slate-400">Name
        <UInput :model-value="listing.name" @update:model-value="set('name', String($event))" />
      </label>
      <label class="col-span-2 flex flex-col gap-1 text-xs text-slate-400">Description
        <UTextarea :model-value="listing.description" :rows="3" @update:model-value="set('description', String($event))" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-slate-400">Rarity
        <USelect :items="RARITIES" :model-value="listing.rarity" @update:model-value="set('rarity', String($event))" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-slate-400">Category
        <USelect :items="CATEGORIES" :model-value="listing.category" @update:model-value="set('category', String($event))" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-slate-400">Sort order
        <UInputNumber :model-value="listing.sortOrder" :step="1" @update:model-value="set('sortOrder', Number($event))" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-slate-400">Price (display)
        <UInputNumber :model-value="listing.price" :min="0" :step="0.01" @update:model-value="set('price', Number($event))" />
      </label>
      <label class="col-span-2 flex flex-col gap-1 text-xs text-slate-400">Discord SKU ID
        <UInput :model-value="listing.discordSkuId" placeholder="Paste the SKU ID" @update:model-value="set('discordSkuId', String($event))" />
      </label>
      <div class="flex items-center gap-3">
        <USwitch :model-value="listing.enabled" @update:model-value="set('enabled', $event)" />
        <div><div class="text-sm font-medium">Live</div><div class="text-xs text-slate-500">Visible in the catalog</div></div>
      </div>
      <div class="flex items-center gap-3">
        <USwitch :model-value="listing.freeForAll" @update:model-value="set('freeForAll', $event)" />
        <div><div class="text-sm font-medium">Free for all</div><div class="text-xs text-slate-500">No purchase needed</div></div>
      </div>
      <p class="col-span-2 font-mono text-xs text-slate-500">id: {{ decorationId }} (fixed after creation)</p>
    </div>

    <div class="flex flex-col gap-4">
      <div v-for="variant in (['owned', 'locked'] as const)" :key="variant" class="relative flex flex-col items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-5">
        <span class="absolute left-3 top-2 text-xs uppercase tracking-wide text-slate-500">{{ variant === "owned" ? "Owned tile" : "Store tile" }}</span>
        <div class="flex gap-0.5" :class="rarityColorClass(listing.rarity)">
          <span v-for="n in rarityPips(listing.rarity)" :key="n">◆</span>
        </div>
        <DecorationStack :layers="stack"><AdminDecoSampleAvatar :size="80" :sample="sample" /></DecorationStack>
        <div class="flex items-center gap-1 text-lg font-medium">
          <UIcon :name="categoryIcon(listing.category)" class="text-slate-400" /> {{ listing.name || "Untitled" }}
        </div>
        <p v-if="listing.description" class="text-center text-sm text-slate-400">{{ listing.description }}</p>
        <span v-if="variant === 'locked' && !listing.freeForAll" class="rounded-md bg-primary-500/20 px-3 py-1 text-sm">
          Purchase for ${{ Number(listing.price).toFixed(2) }}
        </span>
      </div>
    </div>
  </div>
</template>
