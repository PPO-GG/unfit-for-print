<script setup lang="ts">
/**
 * Docked at the bottom of the grid column rather than inserted above it, so
 * starting a selection does not shove the grid down and lose your place.
 *
 * "Move to pack" is a popover anchored to its button, not a modal — a dialog
 * here would stack on whatever else is open, which is the bug that made the
 * rename flow unusable before the redesign.
 */
import { ref } from "vue";

const props = defineProps<{
  count: number;
  totalLoaded: number;
  packs: string[];
  excludePack?: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  move: [string];
  deactivate: [];
  delete: [];
  "select-all": [];
  clear: [];
}>();

const target = ref("");
const open = ref(false);

function confirmMove() {
  const t = target.value.trim();
  if (!t) return;
  emit("move", t);
  target.value = "";
  open.value = false;
}

defineExpose({ target, confirmMove });
</script>

<template>
  <div
    class="flex items-center gap-2 px-3 py-2 border-t border-primary-700/50 bg-primary-950/60"
  >
    <span class="text-xs text-primary-100">{{ count.toLocaleString() }} selected</span>

    <UPopover v-model:open="open">
      <UButton size="xs" color="primary" variant="soft" :loading="loading">
        Move to pack…
      </UButton>
      <template #content>
        <div class="p-3 w-64 flex flex-col gap-2">
          <AdminPackPicker
            v-model="target"
            :packs="packs"
            :exclude="excludePack ? [excludePack] : []"
            label="Destination"
          />
          <UButton size="xs" color="primary" data-testid="move-confirm" :disabled="!target.trim()" @click="confirmMove">
            Move {{ count.toLocaleString() }}
          </UButton>
        </div>
      </template>
    </UPopover>

    <UButton size="xs" color="neutral" variant="ghost" data-testid="deactivate" @click="emit('deactivate')">
      Deactivate
    </UButton>
    <UButton size="xs" color="error" variant="ghost" data-testid="delete" @click="emit('delete')">
      Delete
    </UButton>

    <span class="flex-1" />

    <UButton
      v-if="count < totalLoaded"
      size="xs"
      color="neutral"
      variant="ghost"
      data-testid="select-all"
      @click="emit('select-all')"
    >
      Select all {{ totalLoaded.toLocaleString() }}
    </UButton>
    <UButton
      size="xs"
      color="neutral"
      variant="ghost"
      data-testid="clear"
      @click="emit('clear')"
    >
      Clear
    </UButton>
  </div>
</template>
