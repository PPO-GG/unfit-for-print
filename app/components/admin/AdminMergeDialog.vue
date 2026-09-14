<script setup lang="ts">
/**
 * Merge is the one pack action that cannot be undone and that affects games
 * in progress, so it always goes through this dialog and its summary.
 */
import { computed, ref, watch } from "vue";
import type { AdminPack } from "~/types/adminCard";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{
  sources: AdminPack[];
  packs: AdminPack[];
  summary: (sources: AdminPack[], target: AdminPack) => string;
}>();
const emit = defineEmits<{ confirm: [target: AdminPack] }>();

const targetId = ref("");
watch(open, (isOpen) => {
  if (isOpen) targetId.value = "";
});

const target = computed(() => props.packs.find((p) => p.id === targetId.value) ?? null);
const valid = computed(() => Boolean(target.value) && props.sources.some((s) => s.id !== targetId.value));

// AdminPack's nullable fields (e.g. description) don't satisfy Nuxt UI's
// SelectMenuItem shape, so the menu gets a plain { id, name } projection.
const menuItems = computed(() => props.packs.map((p) => ({ id: p.id, name: p.name })));

function confirmMerge() {
  if (!valid.value || !target.value) return;
  emit("confirm", target.value);
  open.value = false;
}
</script>

<template>
  <UModal v-model:open="open" :title="`Merge ${sources.length} pack${sources.length === 1 ? '' : 's'}`">
    <template #body>
      <UFormField label="Merge into">
        <USelectMenu
          v-model="targetId"
          data-testid="merge-target"
          :items="menuItems"
          value-key="id"
          label-key="name"
          class="w-full"
          placeholder="Choose the pack that stays"
        />
      </UFormField>
      <p v-if="target" data-testid="merge-summary" class="mt-3 text-sm text-amber-300/90">
        {{ summary(sources, target) }}
      </p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton variant="ghost" color="neutral" @click="open = false">Cancel</UButton>
        <UButton color="warning" data-testid="merge-confirm" :disabled="!valid" @click="confirmMerge">Merge</UButton>
      </div>
    </template>
  </UModal>
</template>
