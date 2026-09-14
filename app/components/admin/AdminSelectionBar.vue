<script setup lang="ts">
/** Docked under a pane; the same enabled actions the context menu offers. */
import type { ActionId, ExplorerAction } from "~/composables/useExplorerActions";

defineProps<{ label: string; actions: ExplorerAction[]; busy?: boolean }>();
const emit = defineEmits<{ run: [ActionId]; clear: [] }>();
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-primary-700/50 bg-primary-950/60">
    <span class="text-xs text-primary-100 mr-1">{{ label }}</span>
    <UButton
      v-for="a in actions"
      :key="a.id"
      size="xs"
      :data-testid="`bar-${a.id}`"
      :color="a.danger ? 'error' : 'neutral'"
      :variant="a.danger ? 'ghost' : 'soft'"
      :icon="a.icon"
      :loading="busy"
      @click="emit('run', a.id)"
    >
      {{ a.label }}
    </UButton>
    <span class="flex-1" />
    <UButton size="xs" variant="ghost" color="neutral" data-testid="bar-clear" @click="emit('clear')">
      Clear <UKbd value="Esc" size="sm" />
    </UButton>
  </div>
</template>
