<script setup lang="ts">
import { useUiStore } from '~/stores/uiStore';
import { version } from '~/utils/version';
import { useI18n } from 'vue-i18n'
import markdownit from 'markdown-it'
import privacypolicy from '~/content/privacypolicy.md?raw'
const md = new markdownit({
	html: true,
	linkify: true,
	typographer: true
})

const policy = md.render(privacypolicy)
const uiStore = useUiStore();
const { t } = useI18n()
</script>

<template>
	<footer>
		<!-- Updated classes: hidden by default, flex container on sm and up -->
		<div class="hidden w-screen items-center p-4 backdrop-blur-2xl text-white shadow-md font-['Bebas_Neue'] text-2xl font-medium border-t-2 border-slate-700/25 gap-10 sm:flex">
			<div class="flex-1 flex justify-start">
				<p class="text-sm">{{ t('footer.copyright') }}</p>
			</div>

			<div class="flex-1 flex justify-center">
				<p class="text-sm">Made with ❤️ by MYND @ PPO.GG</p>
				<NuxtLink to="https://github.com/PPO-GG/unfit-for-print" target="_blank" class="text-sm text-gray-400 ml-4 cursor-pointer">{{ version }}</NuxtLink>
			</div>

			<div class="flex-1 flex justify-end items-center gap-4">
				<LanguageSwitcher />
				<UTooltip arrow :text="t('nav.privacy_policy')" class="cursor-pointer">
					<!-- Call the store action on click -->
					<UButton @click="uiStore.togglePolicyModal(true)" icon="i-solar-shield-check-line-duotone" color="neutral" variant="ghost" size="xl" class="rounded-full"/>
				</UTooltip>
			</div>

		</div>
	</footer>
	<!-- Bind v-model:open to the store state -->
	<UModal v-model:open="uiStore.showPolicy" :title="t('modal.privacy_policy')" fullscreen class="m-4 rounded-lg backdrop-blur-2xl bg-slate-900/50">
		<template #body>
			<div class="prose prose-invert max-w-none" v-html="policy" />
		</template>
		<template #footer>
			<span class="text-sm">June 1, 2025 · © Unfit for Print</span>
		</template>
	</UModal>
</template>


<style scoped>

</style>
