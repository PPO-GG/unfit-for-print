<script setup lang="ts">
import { ref, watch } from "vue";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ count: number; initial: string }>();
const emit = defineEmits<{ confirm: [series: string] }>();

const series = ref(props.initial);
watch(open, (isOpen) => {
  if (isOpen) series.value = props.initial;
});

function confirmSeries() {
  emit("confirm", series.value.trim());
  open.value = false;
}
</script>

<template>
  <UModal v-model:open="open" title="Set series">
    <template #body>
      <UFormField label="Series / brand" help="Leave empty to clear it.">
        <UInput v-model="series" class="w-full" placeholder="e.g. Cards Against Humanity" />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton variant="ghost" color="neutral" @click="open = false">Cancel</UButton>
        <UButton color="primary" data-testid="series-confirm" @click="confirmSeries">
          Set for {{ count }} pack{{ count === 1 ? "" : "s" }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
