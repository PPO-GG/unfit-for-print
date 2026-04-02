<template>
  <ClientOnly>
    <UModal
      :open="isOpen"
      @update:open="onModalClose"
      :prevent-close="true"
      :title="options.title"
      :description="options.message"
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
              {{ options.title }}
            </h3>
          </div>
        </template>

        <div class="py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line">
          {{ options.message }}
        </div>

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
      </UCard>
    </UModal>
  </ClientOnly>
</template>

<script lang="ts" setup>
const { isOpen, options, onConfirm, onCancel } = useConfirm();

function onModalClose(open: boolean) {
  if (!open) onCancel();
}
</script>
