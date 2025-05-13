<template>
	<div class="p-6 space-y-6 text-white flex justify-center items-center flex-col align-middle h-screen">
		<div class="p-6 max-w-5xl mx-auto space-y-6">
			<h1 class="text-4xl font-bold font-['Bebas_Neue']">Available Games</h1>

			<ul v-if="lobbies.length" class="space-y-4">
				<li v-for="lobby in lobbies" :key="lobby.$id" class="bg-slate-800 p-4 rounded shadow">
					<div class="flex justify-between items-center">
						<div>
							<h2 class="text-xl font-semibold uppercase">{{ lobby.lobbyName || 'Unnamed Lobby' }}</h2>
							<p class="text-gray-400 text-sm">Lobby Code: {{ lobby.code }}</p>
							<p class="text-gray-400 text-sm">Status: {{ lobby.status }}</p>
							<p class="text-gray-400 text-sm">Host: {{ getHostName(lobby) }}</p>
						</div>
						<UButton color="primary" @click="handleJoined(lobby.code)">Join Game</UButton>
					</div>
				</li>
			</ul>

			<p v-else class="text-gray-400 text-center">No public games available right now.</p>
		</div>
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
import { getAppwrite } from '~/utils/appwrite'
import { Query } from 'appwrite'
import { useGetPlayerName } from '~/composables/useGetPlayerName'

import type { GameSettings } from '~/types/gamesettings'
import type { Lobby } from '~/types/lobby'

const { databases } = getAppwrite()
const config = useRuntimeConfig()
const showJoin = ref(false)
const showCreate = ref(false)
const { getPlayerName, getPlayerNameSync } = useGetPlayerName()

const DB_ID = config.public.appwriteDatabaseId
const LOBBY_COL = config.public.appwriteLobbyCollectionId
const GAMESETTINGS_COL = config.public.appwriteGameSettingsCollectionId

type LobbyWithName = Lobby & {
	lobbyName?: string | null
	hostName?: string
}
const lobbies = ref<LobbyWithName[]>([])

const router = useRouter()
const userStore = useUserStore()
const {getActiveLobbyForUser} = useLobby()
const {showIfAuthenticated} = useUserAccess()
const hostNames = ref<Record<string, string>>({})

const fetchPublicLobbies = async () => {
	try {
		const lobbyRes = await databases.listDocuments<Lobby>(DB_ID, LOBBY_COL, [
			Query.equal('status', 'waiting'),
			Query.orderDesc('$createdAt'),
			Query.limit(100)
		])

		const settingsRes = await databases.listDocuments<GameSettings>(DB_ID, GAMESETTINGS_COL, [
			Query.limit(1000)
		])

		const settingsMap: Record<string, GameSettings> = {}
		for (const setting of settingsRes.documents) {
			const lobbyId = typeof setting.lobbyId === 'object' ? setting.lobbyId.$id : setting.lobbyId
			settingsMap[lobbyId] = setting
		}

		const publicLobbies: LobbyWithName[] = []

		for (const lobby of lobbyRes.documents) {
			const settings = settingsMap[lobby.$id]
			if (!settings || settings.isPrivate) continue

			// Start fetching the host name in the background
			if (lobby.hostUserId) {
				getPlayerName(lobby.hostUserId).then(name => {
					hostNames.value[lobby.hostUserId] = name
				})
			}

			publicLobbies.push({
				...lobby,
				lobbyName: settings.lobbyName || 'Unnamed Lobby'
			})
		}

		lobbies.value = publicLobbies
	} catch (err) {
		console.error('Failed to fetch public lobbies:', err)
	}
}

// Function to get host name for a specific lobby
const getHostName = (lobby: LobbyWithName): string => {
	if (!lobby.hostUserId) return 'Unknown Host'

	// Use the synchronous version which will return from cache if available
	// or trigger a background fetch if not
	return getPlayerNameSync(lobby.hostUserId)
}

onMounted(async () => {
	await userStore.fetchUserSession()
	await fetchPublicLobbies()
	const userId = userStore.user?.$id
	if (userId) {
		const activeLobby = await getActiveLobbyForUser(userId)
		// if (activeLobby?.code) {
		// 	return router.replace(`/game/${activeLobby.code}`)
		// }
	}
})

const handleJoined = (code: string) => {
	return router.replace(`/game/${code}`)
}
</script>
