<script lang="ts" setup>
import {useUiStore} from '~/stores/uiStore';
import {version} from '~/utils/version';
import {useI18n} from 'vue-i18n'
import markdownit from 'markdown-it'
import privacypolicy from '~/content/privacypolicy.md?raw'

const md = new markdownit({
	html: true,
	linkify: true,
	typographer: true
})

const policy = md.render(privacypolicy)
const uiStore = useUiStore();
const {t} = useI18n()
</script>

<template>
	<footer>
		<!-- Updated classes: hidden by default, flex container on sm and up -->
		<div
				class="hidden w-screen items-center p-4 backdrop-blur-sm  dark:bg-slate-900/50 dark:text-white text-slate-700 shadow-md font-['Bebas_Neue'] text-2xl font-medium border-t-2 border-slate-700/25 gap-10 sm:flex">
			<div class="flex-1 flex justify-start">
				<p class="text-sm dark:text-white text-slate-700">{{ t('footer.copyright') }}</p>
			</div>

			<div class="flex-1 flex justify-center items-center align-middle gap-2">
				<p class="text-sm h-full flex items-center">Made with ❤️ by MYND @ PPO.GG</p>
				<ClientOnly>
					<NuxtLink class="h-full flex items-center cursor-pointer align-middle mb-1 w-12 bg-slate-600 rounded-md" target="_blank"
					          to="https://github.com/PPO-GG/unfit-for-print"><img
							alt="GitHub package.json version"
							src="https://img.shields.io/github/package-json/v/PPO-GG/unfit-for-print?style=flat-square&logo=github&label=%20&labelColor=rgba(0%2C0%2C0%2C0)&color=rgba(0%2C0%2C0%2C0)">
					</NuxtLink>
				</ClientOnly>
			</div>

			<div class="flex-1 flex justify-end items-center gap-4">
				<VoiceSwitcher/>
				<LanguageSwitcher/>
				<ThemeSwitcher/>
				<UTooltip :text="t('nav.privacy_policy')" arrow class="cursor-pointer">
					<!-- Call the store action on click -->
					<UButton class="rounded-full" color="neutral" icon="i-solar-shield-check-line-duotone"
					         size="xl" variant="ghost" @click="uiStore.togglePolicyModal(true)"/>
				</UTooltip>
			</div>

		</div>
	</footer>
	<!-- Bind v-model:open to the store state -->
	<UModal v-model:open="uiStore.showPolicy" :title="t('modal.privacy_policy')" class="m-4 rounded-lg backdrop-blur-2xl bg-slate-900/50"
	        fullscreen>
		<template #body>
			<div class="prose prose-invert max-w-none" v-html="policy"/>
		</template>
		<template #footer>
			<span class="text-sm">June 1, 2025 · © Unfit for Print</span>
		</template>
	</UModal>
</template>


<style scoped>

</style>
