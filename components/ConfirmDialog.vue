<template>
	<ClientOnly>
		<UModal v-if="isOpen" v-model="isOpen" :prevent-close="true" class="flex items-center justify-center">
			<UCard :class="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
				<template #header>
					<div class="flex items-center justify-between">
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
							{{ options.title }}
						</h3>
					</div>
				</template>

				<div class="py-4 text-sm text-gray-500 dark:text-gray-400">
					{{ options.message }}
				</div>

				<template #footer>
					<div class="flex justify-end gap-3">
						<!-- Use native buttons instead of UButton to avoid RouterLink issues -->
						<UButton
								color="success"
								variant="soft"
								class="p-3"
								@click="onCancel"
						>
							{{ options.cancelButtonText }}
						</UButton>
						<UButton
								color="error"
								variant="soft"
								class="p-3"
								@click="onConfirm"
						>
							{{ options.buttonText }}
						</UButton>
					</div>
				</template>
			</UCard>
		</UModal>
	</ClientOnly>
</template>

<script lang="ts" setup>
import {useConfirm} from '~/composables/useConfirm';

const {isOpen, options, onConfirm, onCancel} = useConfirm();
</script>
