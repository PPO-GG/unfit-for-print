<script setup lang="ts">
import { ref, watch } from "vue";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ count: number; packNames: string[] }>();
const emit = defineEmits<{ confirm: [name: string] }>();

const name = ref("");
watch(open, (isOpen) => {
  if (isOpen) name.value = "";
});

const plural = (n: number) => `${n} card${n === 1 ? "" : "s"}`;

function confirmMove() {
  const trimmed = name.value.trim();
  if (!trimmed) return;
  emit("confirm", trimmed);
  open.value = false;
}
</script>

<template>
  <UModal v-model:open="open" :title="`Move ${plural(props.count)}`">
    <template #body>
      <AdminPackPicker v-model="name" :packs="packNames" label="Destination pack" />
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton variant="ghost" color="neutral" @click="open = false">Cancel</UButton>
        <UButton color="primary" data-testid="move-confirm" :disabled="!name.trim()" @click="confirmMove">
          Move {{ plural(count) }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
