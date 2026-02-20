<template>
  <ClientOnly>
    <UModal
      :open="modelValue"
      @update:open="emit('update:modelValue', $event)"
      :prevent-close="true"
      :title="title"
      :description="message"
      class="flex items-center justify-center"
    >
      <UCard
        :class="{
          ring: '',
          divide: 'divide-y divide-gray-100 dark:divide-gray-800',
        }"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <h3
              class="text-base font-semibold leading-6 text-gray-900 dark:text-white"
            >
              {{ title }}
            </h3>
          </div>
        </template>

        <div class="py-4 text-sm text-gray-500 dark:text-gray-400">
          {{ message }}
        </div>

        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton
              :color="cancelButtonColor"
              variant="soft"
              class="p-3"
              @click="handleCancel"
            >
              {{ cancelButtonText }}
            </UButton>
            <UButton
              :color="confirmButtonColor"
              variant="soft"
              class="p-3"
              @click="handleConfirm"
            >
              {{ confirmButtonText }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </ClientOnly>
</template>

<script lang="ts" setup>
type ButtonColor =
  | "success"
  | "error"
  | "info"
  | "warning"
  | "neutral"
  | "primary"
  | "secondary";

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    title?: string;
    message?: string;
    confirmButtonText?: string;
    confirmButtonColor?: ButtonColor;
    cancelButtonText?: string;
    cancelButtonColor?: ButtonColor;
  }>(),
  {
    modelValue: false,
    title: "Confirm",
    message: "Are you sure you want to proceed?",
    confirmButtonText: "Confirm",
    confirmButtonColor: "error",
    cancelButtonText: "Cancel",
    cancelButtonColor: "neutral",
  },
);

// Emits
const emit = defineEmits(["confirm", "cancel", "update:modelValue"]);

// Methods
function handleConfirm() {
  emit("update:modelValue", false);
  emit("confirm");
}

function handleCancel() {
  emit("update:modelValue", false);
  emit("cancel");
}
</script>
