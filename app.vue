<template class="subpixel-antialiased">
	<ClientOnly>
    <UApp>
      <NuxtLayout>
	      <div v-if="isDev" class="font-['Bebas_Neue'] fixed top-4 left-[-45px] backdrop-blur-2xl text-md font-bold uppercase tracking-wider rotate-[-45deg] w-48 text-center shadow-lg translate-y-4 z-[100]">
		      <UButton to="https://git.ppo.gg/MYND/unfit-for-print" target="_blank" icon="i-logos-gitlab" variant="link" color="warning" >Dev Preview</UButton>
	      </div>
          <NuxtPage />
      </NuxtLayout>
    </UApp>
	</ClientOnly>
</template>
<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { useRoute } from '#vue-router'
import { useHead, useAsyncData, useRuntimeConfig } from '#imports'
import type { Lobby } from '~/types/lobby'

const isDev = import.meta.env.DEV
const lobby = ref<Lobby | null>(null)
const route = useRoute()
const config = useRuntimeConfig()

watchEffect(async () => {
	const path = route.path
	const match = path.match(/^\/game\/([^/]+)$/)

	if (match) {
		const code = match[1]
		const { data } = await useAsyncData(`lobby-${code}`, () =>
				$fetch<Lobby>(`/api/lobby/${code}`)
		)
		lobby.value = data.value

		useHead({
			title: `Unfit for Print | Game ${code}`,
			meta: [
				{ name: 'description', content: 'Join the chaos in Unfit for Print – a Cards Against Humanity-inspired party game!' },
				{ property: 'og:site_name', content: 'Unfit for Print' },
				{ property: 'og:title', content: `Unfit for Print - Game ${code}` },
				{ property: 'og:description', content: lobby.value?.hostUserId ? `Hosted by ${lobby.value.hostUserId}` : 'A hilarious and chaotic web game. Join this lobby and play with friends!' },
				{ property: 'og:type', content: 'website' },
				{ property: 'og:url', content: `${config.public.baseUrl}/game/${code}` },
				{ property: 'og:image', content: `${config.public.baseUrl}/api/og?code=${code}` },
				{ property: 'og:image:type', content: 'image/png' },
				{ property: 'og:image:width', content: '1200' },
				{ property: 'og:image:height', content: '630' }
			],
			link: [
				{ rel: 'canonical', href: `${config.public.baseUrl}/game/${code}` }
			]
		})
	} else {
		// Default meta for all other routes
		useHead({
			title: 'Unfit for Print',
			meta: [
				{ name: 'description', content: 'Play the ultimate irreverent party card game online!' },
				{ property: 'og:site_name', content: 'Unfit for Print' },
				{ property: 'og:title', content: 'Unfit for Print' },
				{ property: 'og:description', content: 'Join or create your own card game lobbies and cause chaos with friends.' },
				{ property: 'og:type', content: 'website' },
				{ property: 'og:url', content: config.public.baseUrl },
				{ property: 'og:image', content: `${config.public.baseUrl}/img/og.png` },
			],
			link: [
				{ rel: 'canonical', href: config.public.baseUrl }
			]
		})
	}
})
</script>
