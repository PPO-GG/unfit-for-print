<template>
  <!-- Modal and Slideover set no z-index, so overlays stack by portal order
       in <body>. A slideover mounted after this (the admin lobby drawer, in
       the page's <ClientOnly>) would cover the confirm it opened. Sits above
       the in-game menu (GameEscMenu, z-index 200, which opens the "Remove
       player?" confirm) and below the z-[250] popovers in app.config.ts. -->
  <ClientOnly>
    <UModal
      :open="isOpen"
      :dismissible="false"
      :close="false"
      :title="options.title"
      :ui="{ overlay: 'z-[210]', content: 'z-[210]' }"
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
