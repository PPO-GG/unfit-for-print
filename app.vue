<template>
	<UApp>
			<NuxtLayout>
				<div v-if="isDev"
				     class="fixed top-0 left-0 border-t-1 h-0 border-amber-500 w-full z-50 items-center flex justify-start">
					<span class="text-[0.5em] dark:text-white text-black font-mono mt-4 ml-1">DEV MODE</span>
				</div>
				<LoadingOverlay :is-loading="isPageLoading"/>
				<NuxtPage/>
			</NuxtLayout>
	</UApp>
</template>
<script lang="ts" setup>
import {ref, watchEffect, onMounted} from 'vue'
import {useRoute} from '#vue-router'
import {useHead, useAsyncData, useRuntimeConfig, useNuxtApp} from '#imports'
import type {Lobby} from '~/types/lobby'
const isDev = import.meta.env.DEV
const isPageLoading = ref(true)

// Handle page loading state
onMounted(() => {
	// Set loading to false after the page is mounted
	setTimeout(() => {
		isPageLoading.value = false
	}, 250) // Small delay to ensure components are rendered
})

// Show loading overlay during page transitions
const nuxtApp = useNuxtApp()
nuxtApp.hook('page:start', () => {
	isPageLoading.value = true
})
nuxtApp.hook('page:finish', () => {
	setTimeout(() => {
		isPageLoading.value = false
	}, 200) // Small delay to ensure smooth transition
})
const lobby = ref<Lobby | null>(null)
const route = useRoute()
const config = useRuntimeConfig()

watchEffect(async () => {
	const path = route.path
	const match = path.match(/^\/game\/([^/]+)$/)

	if (match) {
		const code = match[1]
		const {data} = await useAsyncData(`lobby-${code}`, () =>
				$fetch<Lobby>(`/api/lobby/${code}`)
		)
		lobby.value = data.value

		useHead({
			title: `Unfit for Print | Game ${code}`,
			meta: [
				{
					name: 'description',
					content: 'Join the chaos in Unfit for Print – a Cards Against Humanity-inspired party game!'
				},
				{property: 'og:site_name', content: 'Unfit for Print'},
				{property: 'og:title', content: `Unfit for Print - Game ${code}`},
				{
					property: 'og:description',
					content: lobby.value?.hostUserId ? `Hosted by ${lobby.value.hostUserId}` : 'A hilarious and chaotic web game. Join this lobby and play with friends!'
				},
				{property: 'og:type', content: 'website'},
				{property: 'og:url', content: `${config.public.baseUrl}/game/${code}`},
				{property: 'og:image', content: `${config.public.baseUrl}/api/og?code=${code}`},
				{property: 'og:image:type', content: 'image/png'},
				{property: 'og:image:width', content: '1200'},
				{property: 'og:image:height', content: '630'}
			],
			link: [
				{rel: 'canonical', href: `${config.public.baseUrl}/game/${code}`},
				{rel: 'icon', type: 'image/png', href: `${config.public.baseUrl}/img/favicon.png`}
			]
		})
	} else {
		// Default meta for all other routes
		useHead({
			title: 'Unfit for Print',
			meta: [
				{
					name: 'description',
					content: 'Join the chaos in Unfit for Print – a Cards Against Humanity-inspired party game!'
				},
				{property: 'og:site_name', content: 'Unfit for Print'},
				{property: 'og:title', content: 'Unfit for Print'},
				{
					property: 'og:description',
					content: 'Join or create your own card game lobbies and cause chaos with friends.'
				},
				{property: 'og:type', content: 'website'},
				{property: 'og:url', content: config.public.baseUrl},
				{property: 'og:image', content: `${config.public.baseUrl}/img/og.png`},
			],
			link: [
				{rel: 'canonical', href: config.public.baseUrl},
				{rel: 'icon', type: 'image/png', href: `${config.public.baseUrl}/img/favicon.png`}
			]
		})
	}
})
</script>
