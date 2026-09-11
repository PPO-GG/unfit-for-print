<script setup lang="ts">
/**
 * The decoration at the sizes players actually see it. The 24px header
 * avatar is the real test of a decoration, not the big stage.
 */
import type { DecorationLayers } from "#shared/decorationLayers";
import DecorationStack from "~/components/decorations/DecorationStack.vue";
import AdminDecoSampleAvatar from "./AdminDecoSampleAvatar.vue";

defineProps<{ stack: DecorationLayers; sample: "photo" | "initials" }>();

const CONTEXT_SIZES = { header: 24, seat: 40, profile: 96 } as const;
</script>

<template>
  <div class="flex flex-wrap items-end gap-3">
    <div data-testid="context-header" class="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2">
      <DecorationStack :layers="stack">
        <AdminDecoSampleAvatar :size="CONTEXT_SIZES.header" :sample="sample" />
      </DecorationStack>
      <span class="text-xs text-slate-400">Header</span>
    </div>
    <div data-testid="context-seat" class="flex flex-col items-center gap-1 rounded-lg bg-slate-900 px-4 py-3">
      <DecorationStack :layers="stack">
        <AdminDecoSampleAvatar :size="CONTEXT_SIZES.seat" :sample="sample" />
      </DecorationStack>
      <span class="rounded bg-slate-800 px-2 text-xs text-slate-300">Seat</span>
    </div>
    <div data-testid="context-profile" class="flex flex-col items-center gap-2 rounded-lg bg-slate-900 px-6 py-4">
      <DecorationStack :layers="stack">
        <AdminDecoSampleAvatar :size="CONTEXT_SIZES.profile" :sample="sample" />
      </DecorationStack>
      <span class="text-xs text-slate-400">Profile</span>
    </div>
  </div>
</template>
