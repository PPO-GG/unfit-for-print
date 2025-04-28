<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps({
	error: Object as () => NuxtError
})

const handleError = () => clearError({ redirect: '/' })
</script>

<template>
	<div class="flex flex-col items-center justify-center h-screen">
		<div class="absolute inset-0 text-amber-300 opacity-10 text-[1024px] font-['Bebas_Neue'] pointer-events-none overflow-hidden">
			<span class="m-4">{{ error!.statusCode }}</span>
		</div>
		<span class="text-[256px] font-['Bebas_Neue'] text-amber-300 rotate-12">{{ error!.statusCode }}</span>
		<span class="font-mono mb-8 text-2xl bg-slate-700/25 p-8 rounded-xl">{{ error!.statusMessage }}</span>
		<UButton @click="handleError" variant="subtle" color="warning" size="xl" class="cursor-pointer mt-4 p-6 font-['Bebas_Neue'] text-2xl">Return to Safety!</UButton>
	</div>
</template>