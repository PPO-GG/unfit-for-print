<template>
	<ClientOnly>
		<UModal :open="modelValue" @update:open="emit('update:modelValue', $event)" :prevent-close="true" class="flex items-center justify-center">
			<UCard :class="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
				<template #header>
					<div class="flex items-center justify-between">
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
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

// Props for the component
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Confirm'
  },
  message: {
    type: String,
    default: 'Are you sure you want to proceed?'
  },
  confirmButtonText: {
    type: String,
    default: 'Confirm'
  },
  confirmButtonColor: {
    type: String,
    default: 'error'
  },
  cancelButtonText: {
    type: String,
    default: 'Cancel'
  },
  cancelButtonColor: {
    type: String,
    default: 'success'
  }
});

// Emits
const emit = defineEmits(['confirm', 'cancel', 'update:modelValue']);

// Methods
function handleConfirm() {
  emit('update:modelValue', false);
  emit('confirm');
}

function handleCancel() {
  emit('update:modelValue', false);
  emit('cancel');
}
</script>
