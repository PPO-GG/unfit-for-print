<template>
  <ClientOnly>
    <UModal
      :open="isOpen"
      :dismissible="false"
      :close="false"
      :title="options.title"
      @update:open="onModalClose"
    >
      <template #body>
        <div class="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line">
          {{ options.message }}
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton
            :color="options.cancelButtonColor"
            variant="soft"
            class="p-3"
            @click="onCancel"
          >
            {{ options.cancelButtonText }}
          </UButton>
          <UButton
            :color="options.confirmButtonColor"
            variant="soft"
            class="p-3"
            @click="onConfirm"
          >
            {{ options.confirmButtonText }}
          </UButton>
        </div>
      </template>
    </UModal>
  </ClientOnly>
</template>

<script lang="ts" setup>
const { isOpen, options, onConfirm, onCancel } = useConfirm();

function onModalClose(open: boolean) {
  if (!open) onCancel();
}
</script>
