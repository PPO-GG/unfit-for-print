<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getAppwrite } from '~/utils/appwrite'
import { Query } from 'appwrite'
import { useNotifications } from '~/composables/useNotifications'
import type { GameSettings } from '~/types/gamesettings'
import type { Lobby } from '~/types/lobby'

// Extended Lobby type that includes the lobbyName property
type LobbyWithName = Lobby & {
  lobbyName?: string | null
}

const { databases } = getAppwrite()
const config = useRuntimeConfig()
const { notify } = useNotifications()

const DB_ID = config.public.appwriteDatabaseId
const LOBBY_COL = config.public.appwriteLobbyCollectionId
const PLAYER_COL = config.public.appwritePlayerCollectionId

const lobbies = ref<LobbyWithName[]>([])
const playersByLobby = ref<Record<string, any[]>>({})
const loading = ref(true)
const searchTerm = ref('')
const statusFilter = ref<string | null>(null)
const totalLobbies = ref(0)
const currentPage = ref(1)
const pageSize = ref(5)

// Status options for filter
const statusOptions = ['waiting', 'active', 'complete']

// Filtered lobbies based on search term and status
const filteredLobbies = computed(() => {
  if (!searchTerm.value && !statusFilter.value) return lobbies.value

  return lobbies.value.filter(lobby => {
    const matchesSearch = !searchTerm.value || 
      (lobby.lobbyName?.toLowerCase() || '').includes(searchTerm.value.toLowerCase()) ||
      lobby.$id.toLowerCase().includes(searchTerm.value.toLowerCase())

    const matchesStatus = !statusFilter.value || lobby.status === statusFilter.value

    return matchesSearch && matchesStatus
  })
})

// Paginated lobbies
const paginatedLobbies = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredLobbies.value.slice(start, end)
})

// Total pages for pagination
const totalPages = computed(() => {
  return Math.ceil(filteredLobbies.value.length / pageSize.value)
})

const checkActiveLobbies = async () => {
	loading.value = true
	try {
		// 1. Fetch all lobbies, ordered by creation date
		const lobbyRes = await databases.listDocuments(DB_ID, LOBBY_COL, [
			Query.orderDesc('$createdAt'),
			Query.limit(100)
		])

		// Store the raw lobbies temporarily
		const rawLobbies = lobbyRes.documents
		totalLobbies.value = lobbyRes.total

		// 2. Fetch game settings for all lobbies
		const GAMESETTINGS_COL = config.public.appwriteGameSettingsCollectionId
		const settingsRes = await databases.listDocuments(DB_ID, GAMESETTINGS_COL, [
			Query.limit(1000) // or adjust as needed
		])

		// Create a map of lobbyId to settings
		const settingsMap: Record<string, GameSettings> = {}
		for (const setting of settingsRes.documents) {
			// Handle case where lobbyId is a relationship object
			const lobbyIdKey = typeof setting.lobbyId === 'object' && setting.lobbyId?.$id 
				? setting.lobbyId.$id 
				: setting.lobbyId;

			settingsMap[lobbyIdKey] = setting as unknown as GameSettings
		}

		// 3. Merge lobby names into lobby objects
		lobbies.value = rawLobbies.map(lobby => {
			// First try direct lookup
			let settings = settingsMap[lobby.$id]

			// If settings not found by exact match, try to find by string comparison
			if (!settings) {
				const matchingSettings = settingsRes.documents.find(s => 
					String(s.lobbyId) === String(lobby.$id)
				)
				if (matchingSettings) {
					settings = matchingSettings as unknown as GameSettings
				}
			}

			return {
				...lobby,
				lobbyName: settings?.lobbyName || null
			} as unknown as LobbyWithName
		})

		// 4. For each lobby, fetch players
		const allPlayersRes = await databases.listDocuments(DB_ID, PLAYER_COL, [
			Query.limit(1000) // or page through if more
		])

		const playersMap: Record<string, any[]> = {}
		for (const player of allPlayersRes.documents) {
			if (!playersMap[player.lobbyId]) playersMap[player.lobbyId] = []
			playersMap[player.lobbyId].push(player)
		}

		playersByLobby.value = playersMap

		// Reset filters when refreshing
		currentPage.value = 1
	} catch (err) {
		console.error('Failed to load lobbies or players:', err)
		notify({
			title: 'Error',
			description: 'Failed to load lobbies or players',
			color: 'error'
		})
	} finally {
		loading.value = false
	}
}

// Mark a lobby as completed
const markLobbyCompleted = async (lobby: LobbyWithName) => {
	try {
		const updated = await databases.updateDocument(DB_ID, LOBBY_COL, lobby.$id, {
			status: 'complete'
		})

		// Update in local list
		const index = lobbies.value.findIndex(l => l.$id === updated.$id)
		if (index !== -1) {
			lobbies.value[index].status = updated.status
		}

		notify({
			title: 'Lobby Marked Completed',
			description: `Lobby "${lobby.lobbyName || 'Unnamed'}" marked as completed`,
			color: 'success'
		})
	} catch (err) {
		console.error('Failed to update lobby:', err)
		notify({
			title: 'Update Failed',
			description: 'Could not mark lobby as completed',
			color: 'error'
		})
	}
}

// Delete a lobby
const deleteLobby = async (lobby: LobbyWithName) => {
	if (!confirm(`Are you sure you want to delete this lobby?\n\n"${lobby.lobbyName || 'Unnamed Lobby'}"\n\nThis will also delete all associated players, game chat messages, and game settings. This cannot be undone.`)) {
		return
	}

	try {
		// First delete all players in this lobby
		const playersInLobby = playersByLobby.value[lobby.$id] || []
		for (const player of playersInLobby) {
			await databases.deleteDocument(DB_ID, PLAYER_COL, player.$id)
		}

		// Delete associated game chat messages
		const GAMECHAT_COL = config.public.appwriteGamechatCollectionId
		// When querying with Query.equal, Appwrite will match both string values and relationship IDs
		const chatMessages = await databases.listDocuments(DB_ID, GAMECHAT_COL, [
			Query.equal('lobbyId', lobby.$id)
		])
		for (const message of chatMessages.documents) {
			await databases.deleteDocument(DB_ID, GAMECHAT_COL, message.$id)
		}

		// Delete associated game settings
		const GAMESETTINGS_COL = config.public.appwriteGameSettingsCollectionId
		// When querying with Query.equal, Appwrite will match both string values and relationship IDs
		const gameSettings = await databases.listDocuments(DB_ID, GAMESETTINGS_COL, [
			Query.equal('lobbyId', lobby.$id)
		])
		for (const setting of gameSettings.documents) {
			await databases.deleteDocument(DB_ID, GAMESETTINGS_COL, setting.$id)
		}

		// Then delete the lobby
		await databases.deleteDocument(DB_ID, LOBBY_COL, lobby.$id)

		// Remove from local lists
		lobbies.value = lobbies.value.filter(l => l.$id !== lobby.$id)
		delete playersByLobby.value[lobby.$id]

		notify({
			title: 'Lobby Deleted',
			description: `Lobby "${lobby.lobbyName || 'Unnamed'}" and all associated data were deleted`,
			color: 'success'
		})
	} catch (err) {
		console.error('Failed to delete lobby:', err)
		notify({
			title: 'Delete Failed',
			description: 'Could not delete the lobby',
			color: 'error'
		})
	}
}

// Reset filters
const resetFilters = () => {
	searchTerm.value = ''
	statusFilter.value = null
	currentPage.value = 1
}

onMounted(async () => {
	await checkActiveLobbies()
})

// Watch for filter changes to reset pagination
watch([searchTerm, statusFilter], () => {
	currentPage.value = 1
})
</script>

<template>
	<div class="space-y-4">
		<!-- Search and Filter Controls -->
		<div class="flex flex-col md:flex-row gap-4">
			<div class="flex gap-4 flex-1">
				<UInput 
					v-model="searchTerm" 
					placeholder="Search lobbies..." 
					class="flex-1" 
					icon="i-solar-magnifer-broken"
				/>
				<USelectMenu 
					v-model="statusFilter" 
					:items="statusOptions" 
					placeholder="Filter by status" 
					clearable
				/>
			</div>
			<div class="flex gap-2">
				<UButton
					@click="resetFilters"
					color="neutral"
					variant="soft"
					icon="i-heroicons-x-mark"
					:disabled="!searchTerm && !statusFilter"
				>
					Clear
				</UButton>
				<UButton
					loading-auto
					@click="checkActiveLobbies"
					color="secondary" 
					variant="soft" 
					icon="i-heroicons-arrow-path"
				>
					Refresh
				</UButton>
			</div>
		</div>

		<!-- Loading State -->
		<div v-if="loading" class="space-y-3">
			<!-- Skeleton cards -->
			<div v-for="i in 5" :key="i" class="bg-slate-700 rounded p-4 flex justify-between items-center relative">
				<div class="max-w-xl mb-4 w-full">
					<USkeleton class="h-5 w-full" />
					<USkeleton class="h-5 w-3/4 mt-2" />
				</div>
				<div class="flex gap-2 absolute left-0 bottom-0 m-2">
					<span class="ml-2 flex items-center">
						<USkeleton class="h-4 w-20" />
					</span>
					<span class="ml-2 flex items-center">
						<USkeleton class="h-4 w-20" />
					</span>
				</div>
				<div class="flex items-center gap-1">
					<USkeleton class="h-8 w-8 rounded" />
					<USkeleton class="h-8 w-8 rounded" />
					<USkeleton class="h-8 w-8 rounded" />
					<USkeleton class="h-8 w-8 rounded" />
				</div>
			</div>
		</div>

		<!-- Empty State -->
		<div v-else-if="!lobbies.length" class="text-center py-8">
			<UIcon name="i-heroicons-user-group" class="h-12 w-12 mx-auto text-gray-400 mb-2" />
			<p class="text-gray-400">No lobbies found.</p>
		</div>

		<!-- No Results State -->
		<div v-else-if="filteredLobbies.length === 0" class="text-center py-8">
			<p class="text-gray-400">No lobbies match your search criteria.</p>
			<UButton class="mt-2" color="neutral" variant="ghost" @click="resetFilters">
				Clear Filters
			</UButton>
		</div>

		<!-- Lobbies List -->
		<ul v-else class="space-y-4">
			<li v-for="lobby in paginatedLobbies" :key="lobby.$id" class="bg-slate-800 p-4 rounded shadow">
				<div class="flex justify-between items-start">
					<div>
						<div class="flex items-center gap-2">
							<h3 class="text-2xl font-semibold font-['Bebas_Neue']">{{ lobby.lobbyName || 'Unnamed Lobby' }}</h3>
							<UBadge class="text-sm text-white font-light font-['Bebas_Neue']" :color="lobby.status === 'complete' ? 'success' : lobby.status === 'playing' ? 'warning' : 'info'">
								{{ lobby.status }}
							</UBadge>
						</div>
						<p class="text-sm text-gray-400">
							Created: {{ new Date(lobby.$createdAt).toLocaleString() }}
							<span class="mx-1">|</span>
							ID: <span class="font-mono">{{ lobby.$id }}</span>
						</p>
					</div>
					<div class="flex items-center gap-2">
						<UBadge color="primary">{{ playersByLobby[lobby.$id]?.length || 0 }} players</UBadge>
						<div class="flex gap-1">
							<UButton 
								v-if="lobby.status !== 'complete'"
								color="warning"
								variant="ghost" 
								icon="i-heroicons-check-circle" 
								size="xs" 
								@click="markLobbyCompleted(lobby)"
								class="rounded-full"
								:tooltip="{ text: 'Mark as completed' }"
							/>
							<UButton 
								color="error"
								variant="ghost" 
								icon="i-heroicons-trash" 
								size="xs" 
								@click="deleteLobby(lobby)"
								class="rounded-full"
								:tooltip="{ text: 'Delete lobby' }"
							/>
						</div>
					</div>
				</div>

				<!-- Players List -->
				<div class="mt-3">
					<p v-if="!playersByLobby[lobby.$id]?.length" class="text-sm text-gray-400">
						No players in this lobby.
					</p>
					<ul v-else class="flex flex-wrap gap-2">
						<li
							v-for="player in playersByLobby[lobby.$id] || []"
							:key="player.$id"
							class="text-xs text-white bg-slate-700 px-2 py-1 rounded flex items-center gap-1"
						>
							<span>{{ player.name }}</span>
							<UBadge v-if="player.provider === 'discord'" color="info" size="xs">Discord</UBadge>
							<UBadge v-else color="neutral" size="xs">Anonymous</UBadge>
						</li>
					</ul>
				</div>
			</li>
		</ul>

		<!-- Pagination -->
		<div v-if="filteredLobbies.length > pageSize" class="flex justify-between items-center mt-4">
			<div class="text-sm text-gray-400">
				Showing {{ (currentPage - 1) * pageSize + 1 }}-{{ Math.min(currentPage * pageSize, filteredLobbies.length) }} of {{ filteredLobbies.length }} lobbies
			</div>
   <UPagination
				v-model:page="currentPage"
				:total="filteredLobbies.length"
				:page-count="totalPages"
				:page-size="pageSize"
				class="flex items-center gap-1"
			/>
		</div>
	</div>
</template>
