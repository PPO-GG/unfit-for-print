<script setup lang="ts">
import { useUiStore } from '~/stores/uiStore';
const uiStore = useUiStore();
</script>

<template>
	<footer>
		<!-- Updated classes: hidden by default, flex container on sm and up -->
		<div class="hidden w-screen items-center p-4 backdrop-blur-2xl text-white shadow-md font-['Bebas_Neue'] text-2xl font-medium border-t-2 border-slate-700/25 gap-10 sm:flex">
			<div class="flex-1 flex justify-start">
				<p class="text-sm">© 2025 Unfit for Print. All rights reserved.</p>
			</div>

			<div class="flex-1 flex justify-center">
				<p class="text-sm">Made with ❤️ by MYND @ <NuxtLink to="https://ppo.gg" target="_blank">PPO.GG</NuxtLink></p>
			</div>

			<div class="flex-1 flex justify-end">
				<UTooltip arrow text="Privacy Policy">
					<!-- Call the store action on click -->
					<UButton @click="uiStore.togglePolicyModal(true)" icon="i-solar-shield-check-line-duotone" color="neutral" variant="ghost" size="xl" class="rounded-full"/>
				</UTooltip>
			</div>

		</div>
	</footer>
	<!-- Bind v-model:open to the store state -->
	<UModal v-model:open="uiStore.showPolicy" title="Unfit For Print Privacy Policy" fullscreen class="m-4 rounded-lg backdrop-blur-2xl bg-slate-900/50">
		<template #body>
			<PrivacyPolicy />
		</template>
		<template #footer>
			<span class="text-sm">Last updated: April 14, 2025 · © Unfit for Print</span>
		</template>
	</UModal>
</template>


<style scoped>

</style>