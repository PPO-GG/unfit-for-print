<script setup lang="ts">
import type { NuxtError } from '#app'
import { watch } from 'vue';

const props = defineProps({
	error: Object as () => NuxtError
});

const title = ref(`WHOA ERROR`);

watch(() => props.error?.statusCode, (newStatusCode) => {
	if (newStatusCode) {
		title.value = `WHOA ERROR ${newStatusCode}`;
	} else {
		title.value = `WHOA ERROR`;
	}
}, { immediate: true });

useHead(() => ({
	title: title.value,
	meta: [
		{ property: 'og:title', content: title.value },
	],
}));

const handleError = () => clearError({ redirect: '/' });
</script>

<template class="subpixel-antialiased">
	<div class="flex flex-col items-center justify-center h-screen">
		<div class="absolute inset-0 text-amber-300 opacity-10 text-[1024px] pointer-events-none overflow-hidden">
			<span class="m-4">{{ error!.statusCode }}</span>
		</div>
		<span class="text-[256px] text-amber-300 rotate-12 ">{{ error!.statusCode }}</span>
		<span class="w-1/2 font-mono mb-8 text-2xl bg-slate-700/25 p-8 rounded-xl wrap-break-word backdrop-blur-sm">{{ error!.statusMessage ?? "WHOAH! Something happened but I don't have an error message for you." }}</span>
		<UButton @click="handleError" variant="subtle" color="warning" size="xl" class="cursor-pointer mt-4 p-6 text-2xl">GET ME OUTTA HERE!</UButton>
	</div>
</template>