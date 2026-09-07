<script setup lang="ts">
/**
 * Picks a destination pack — an existing one, or a new name typed in.
 *
 * Accepting a new name is not a convenience: a pack exists precisely because
 * cards point at it, so typing a name that does not exist yet and moving
 * cards into it *is* how a pack gets created.
 */
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    packs: string[];
    label?: string;
    placeholder?: string;
    exclude?: string[];
  }>(),
  { label: "Destination pack", placeholder: "Pick a pack or type a new name", exclude: () => [] },
);

const emit = defineEmits<{ "update:modelValue": [string] }>();

const trimmed = computed(() => props.modelValue.trim());

const available = computed(() =>
  props.packs.filter((p) => !props.exclude.includes(p)),
);

const suggestions = computed(() => {
  const term = trimmed.value.toLowerCase();
  if (!term) return available.value;
  return available.value.filter((p) => p.toLowerCase().includes(term));
});

const isNewPack = computed(() => {
  if (!trimmed.value) return false;
  const term = trimmed.value.toLowerCase();
  return !props.packs.some((p) => p.toLowerCase() === term);
});

function pick(pack: string) {
  emit("update:modelValue", pack);
}

defineExpose({ suggestions, isNewPack, pick });
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="text-xs font-medium text-slate-400">{{ label }}</label>

    <UInput
      :model-value="modelValue"
      :placeholder="placeholder"
      icon="i-solar-folder-with-files-line-duotone"
      @update:model-value="emit('update:modelValue', String($event))"
    />

    <p v-if="isNewPack" class="text-xs text-primary-400">
      Creates a new pack named &ldquo;{{ trimmed }}&rdquo;.
    </p>

    <div
      v-if="suggestions.length"
      class="max-h-48 overflow-y-auto flex flex-col gap-0.5 rounded-lg border border-slate-700/60 p-1"
    >
      <button
        v-for="pack in suggestions"
        :key="pack"
        type="button"
        class="text-left text-xs px-2 py-1.5 rounded-md text-slate-300 hover:bg-slate-700/60 transition-colors"
        :class="pack === trimmed ? 'bg-slate-700/80 text-white' : ''"
        @click="pick(pack)"
      >
        {{ pack }}
      </button>
    </div>
  </div>
</template>
