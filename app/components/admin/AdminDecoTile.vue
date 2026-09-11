<script setup lang="ts">
import type { DecorationCatalogEntry } from "~/types/decoration";
import { rarityColorClass, rarityPips } from "~/utils/decorationDisplay";
import DecorationStack from "~/components/decorations/DecorationStack.vue";
import AdminDecoSampleAvatar from "./AdminDecoSampleAvatar.vue";

defineProps<{ entry: DecorationCatalogEntry }>();
</script>

<template>
  <NuxtLink
    :to="`/admin/decorations/${entry.decorationId}`"
    data-testid="deco-tile"
    class="flex flex-col items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-5 transition hover:-translate-y-0.5 hover:border-primary-500"
    :class="{ 'opacity-60': !entry.enabled }"
  >
    <div class="flex w-full items-center justify-between text-xs">
      <span :class="rarityColorClass(entry.rarity)"><span v-for="n in rarityPips(entry.rarity)" :key="n">◆</span></span>
      <span class="flex gap-1">
        <UBadge v-if="!entry.enabled" size="sm" variant="subtle" color="neutral">Hidden</UBadge>
        <UBadge v-if="entry.freeForAll" size="sm" variant="subtle" color="secondary">Free</UBadge>
      </span>
    </div>
    <DecorationStack :layers="entry.layers">
      <AdminDecoSampleAvatar :size="64" sample="initials" />
    </DecorationStack>
    <div class="text-center">
      <div class="font-semibold">{{ entry.name }}</div>
      <div class="font-mono text-xs text-slate-500">{{ entry.decorationId }}</div>
    </div>
    <div class="text-xs text-slate-400">
      {{ entry.layers.layers.length }} layer{{ entry.layers.layers.length === 1 ? "" : "s" }} ·
      {{ entry.price > 0 ? `$${entry.price.toFixed(2)}` : "no price" }}
    </div>
  </NuxtLink>
</template>
