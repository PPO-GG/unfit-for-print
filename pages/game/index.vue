<template>
	<div class="p-6 space-y-6 text-white flex justify-center items-center flex-col align-middle h-screen">
		<div class="backdrop-blur-2xl bg-slate-800/25 p-32 rounded-xl shadow-xl flex flex-col items-center space-y-4">
			<h1 class="text-3xl font-bold">Game Portal</h1>
			<p class="text-sm text-gray-400">Join <span v-if="showIfAuthenticated">or create</span> a game lobby to get
				started.</p>

			<div class="space-x-4">
				<UButton size="lg" @click="showJoin = true">Join Game</UButton>
				<UButton v-if="showIfAuthenticated" size="lg" @click="showCreate = true">Create Game</UButton>
			</div>

			<!-- Modals -->
			<UModal v-model:open="showJoin" title="Join a Lobby">
				<template #body>
					<JoinLobbyForm @joined="handleJoined"/>
				</template>
			</UModal>

			<UModal v-model:open="showCreate" title="Create a Lobby">
				<template #body>
					<CreateLobbyDialog @created="handleJoined"/>
				</template>
			</UModal>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {ref, onMounted} from 'vue'
import {useRouter} from 'vue-router'
import {useUserStore} from '~/stores/userStore'
import {useLobby} from '~/composables/useLobby'
import {useUserAccess} from '~/composables/useUserUtils'
import ScrollingBackground from "~/components/ScrollingBackground.vue";

const showJoin = ref(false)
const showCreate = ref(false)

const router = useRouter()
const userStore = useUserStore()
const {getActiveLobbyForUser} = useLobby()
const {showIfAuthenticated} = useUserAccess()

onMounted(async () => {
	await userStore.fetchUserSession()

	const userId = userStore.user?.$id
	if (userId) {
		const activeLobby = await getActiveLobbyForUser(userId)
		if (activeLobby?.code) {
			return router.replace(`/game/${activeLobby.code}`)
		}
	}
})

const handleJoined = (code: string) => {
	router.push(`/game/${code}`)
}
</script>
