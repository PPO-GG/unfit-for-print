<template>
	<ClientOnly>
		<UModal :open="modelValue" @update:open="emit('update:modelValue', $event)" :prevent-close="true" class="flex items-center justify-center">
			<UCard :class="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
				<template #header>
					<div class="flex items-center justify-between gap-3">
						<div class="i-mdi-alert-circle text-2xl text-yellow-500" />
						<h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
							{{ t('browser.firefox_privacy_warning') }}
						</h3>
					</div>
				</template>

				<div class="py-4 space-y-4">
					<p class="text-sm text-gray-500 dark:text-gray-400">
						{{ t('browser.firefox_privacy_instructions') }}
					</p>
					<div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
						<h4 class="font-medium text-sm mb-2">{{ t('browser.steps_to_fix') }}</h4>
						<ol class="list-decimal list-inside text-sm text-gray-600 dark:text-gray-300 space-y-2">
							<li>{{ t('browser.step_1') }}</li>
							<li>{{ t('browser.step_2') }}</li>
							<li>{{ t('browser.step_3') }}</li>
						</ol>
					</div>
					<p class="text-xs text-gray-400 dark:text-gray-500">
						{{ t('browser.privacy_note') }}
					</p>
				</div>

				<template #footer>
					<div class="flex justify-end gap-3">
						<UButton
							color="gray"
							variant="soft"
							class="p-3"
							@click="emit('update:modelValue', false)"
						>
							{{ t('browser.remind_later') }}
						</UButton>
						<UButton
							color="primary"
							variant="solid"
							class="p-3"
							@click="handleProceed"
						>
							{{ t('browser.understood') }}
						</UButton>
					</div>
				</template>
			</UCard>
		</UModal>
	</ClientOnly>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const emit = defineEmits(['update:modelValue', 'proceed'])

defineProps<{
	modelValue: boolean
}>()

const handleProceed = () => {
	emit('update:modelValue', false)
	emit('proceed')
}
</script>
