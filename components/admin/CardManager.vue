<script setup lang="ts">
import { getAppwrite } from '~/utils/appwrite'
import { Query } from 'appwrite'
import { useNotifications } from '~/composables/useNotifications'
import { ref, computed, watch, onMounted } from 'vue'
import { watchDebounced } from '@vueuse/core'

const { databases } = getAppwrite()
const config = useRuntimeConfig()
const { notify } = useNotifications()

const searchTerm = ref('')
const selectedPack = ref(null)
const availablePacks = ref<string[]>([])
const cards = ref<any[]>([])
const loading = ref(false)
const totalCards = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const showEditModal = ref(false)
const editingCard = ref<any>(null)
const newCardText = ref('')

const DB_ID = config.public.appwriteDatabaseId
const cardType = ref<'white' | 'black'>('black')

const CARD_COLLECTIONS = {
	black: config.public.appwriteBlackCardCollectionId as string,
	white: config.public.appwriteWhiteCardCollectionId as string
}
const CARD_COLLECTION = computed(() => CARD_COLLECTIONS[cardType.value])

// Fetch available card packs on mount
onMounted(async () => {
	try {
		const result = await databases.listDocuments(DB_ID, CARD_COLLECTION.value, [Query.limit(100)])
		const packs = new Set(result.documents.map(doc => doc.pack).filter(Boolean))
		availablePacks.value = Array.from(packs).sort()
		// Initial fetch of cards
		await fetchCards()
	} catch (err) {
		console.error('Failed to load packs:', err)
	}
})

// Watch for card type changes to reload packs
watch(cardType, async () => {
	try {
		const result = await databases.listDocuments(DB_ID, CARD_COLLECTION.value, [Query.limit(100)])
		const packs = new Set(result.documents.map(doc => doc.pack).filter(Boolean))
		availablePacks.value = Array.from(packs).sort()
		// Reset page and refetch cards
		currentPage.value = 1
		await fetchCards()
	} catch (err) {
		console.error('Failed to load packs:', err)
	}
})

// Fetch cards
const fetchCards = async () => {
	loading.value = true

	const queries = []

	// Fetch all cards (with a reasonable limit)
	queries.push(Query.limit(500))

	// Note: We're still using server-side filtering for initial fetch
	// but will also filter client-side for pagination
	if (searchTerm.value) {
		queries.push(Query.search('text', searchTerm.value))
	}

	if (selectedPack.value) {
		queries.push(Query.equal('pack', selectedPack.value))
	}

	try {
		const result = await databases.listDocuments(DB_ID, CARD_COLLECTION.value, queries)
		cards.value = result.documents
		totalCards.value = result.total

		// Reset to page 1 when fetching new cards
		currentPage.value = 1

		console.log(`Fetched ${result.documents.length} cards`)
	} catch (err) {
		console.error('Failed to fetch cards:', err)
	} finally {
		loading.value = false
	}
}

// Filtered cards based on search term and pack
const filteredCards = computed(() => {
	if (!searchTerm.value && !selectedPack.value) return cards.value

	return cards.value.filter(card => {
		const matchesSearch = !searchTerm.value || 
			card.text.toLowerCase().includes(searchTerm.value.toLowerCase())

		const matchesPack = !selectedPack.value || card.pack === selectedPack.value

		return matchesSearch && matchesPack
	})
})

// Paginated cards
const paginatedCards = computed(() => {
	const start = (currentPage.value - 1) * pageSize.value
	const end = start + pageSize.value
	return filteredCards.value.slice(start, end)
})

// Total pages for pagination
const totalPages = computed(() => {
	return Math.ceil(filteredCards.value.length / pageSize.value)
})

// Reset page when search or filter changes
watchDebounced(
		[searchTerm, selectedPack],
		() => {
			currentPage.value = 1
			fetchCards()
		},
		{ debounce: 500, maxWait: 1000 },
)

// Watch for card type changes
watch(cardType, () => {
	currentPage.value = 1
})

// Add console log for debugging pagination
watch(currentPage, (newPage) => {
	console.log(`Page changed to ${newPage}`)
})

const toggleCardActive = async (card: any) => {
	try {
		const updated = await databases.updateDocument(DB_ID, CARD_COLLECTION.value, card.$id, {
			active: !card.active
		})
		card.active = updated.active
		notify({
			title: `Card ${updated.active ? 'Activated' : 'Deactivated'}`,
			description: card.text,
			color: 'success'
		})
	} catch (err) {
		console.error('Failed to update card:', err)
		notify({
			title: 'Update Failed',
			description: 'Could not toggle card status.',
			color: 'error'
		})
	}
}

const deleteCard = async (card: any) => {
	if (!confirm(`Are you sure you want to delete this card?\n\n"${card.text}"`)) {
		return
	}

	try {
		await databases.deleteDocument(DB_ID, CARD_COLLECTION.value, card.$id)
		// Remove from local list
		cards.value = cards.value.filter(c => c.$id !== card.$id)
		totalCards.value--

		notify({
			title: 'Card Deleted',
			description: 'The card was successfully deleted.',
			color: 'success'
		})
	} catch (err) {
		console.error('Failed to delete card:', err)
		notify({
			title: 'Delete Failed',
			description: 'Could not delete the card.',
			color: 'error'
		})
	}
}

const openEditModal = (card: any) => {
	editingCard.value = card
	newCardText.value = card.text
	showEditModal.value = true
}

const saveCardEdit = async () => {
	if (!editingCard.value || !newCardText.value.trim()) {
		return
	}

	try {
		const updated = await databases.updateDocument(DB_ID, CARD_COLLECTION.value, editingCard.value.$id, {
			text: newCardText.value.trim()
		})

		// Update in local list
		const index = cards.value.findIndex(c => c.$id === updated.$id)
		if (index !== -1) {
			cards.value[index].text = updated.text
		}

		showEditModal.value = false
		editingCard.value = null
		newCardText.value = ''

		notify({
			title: 'Card Updated',
			description: 'The card was successfully updated.',
			color: 'success'
		})
	} catch (err) {
		console.error('Failed to update card:', err)
		notify({
			title: 'Update Failed',
			description: 'Could not update the card.',
			color: 'error'
		})
	}
}
</script>

<template>
	<div class="space-y-4">
		<div class="flex gap-4 items-center">
			<UInput v-model="searchTerm" placeholder="Search card text..." class="flex-1" icon="i-solar-magnifer-broken" />
			<USelectMenu v-model="selectedPack" :items="availablePacks" placeholder="Filter by pack" clearable />
			<USelectMenu v-model="cardType" :items="['black', 'white']" />
		</div>

		<div v-if="loading" class="flex justify-center py-8">
			<UIcon name="i-solar-restart-circle-line-duotone" class="animate-spin h-8 w-8 text-gray-400" />
		</div>

		<div v-else-if="!cards.length && (searchTerm || selectedPack)">
			<p class="text-gray-400 text-center py-8">No cards found matching your criteria.</p>
		</div>

		<div v-else-if="!cards.length">
			<p class="text-gray-400 text-center py-8">Enter a search term or select a pack to view cards.</p>
		</div>

		<ul v-else class="space-y-3">
			<li v-for="card in paginatedCards" :key="card.$id" class="bg-slate-700 rounded p-4 flex justify-between items-center">
				<div class="text-sm font-mono text-white max-w-xl">
					{{ card.text }}
					<span class="ml-2 text-xs text-gray-400">({{ card.pack }})</span>
					<span class="ml-2 text-xs text-gray-400">({{ card.$id }})</span>
				</div>
				<div class="flex items-center gap-1">
					<USwitch v-model="card.active" @click.stop="toggleCardActive(card)" />
					<UButton color="neutral" variant="ghost" icon="i-solar-pen-new-square-line-duotone" size="md" @click="openEditModal(card)"/>
					<UButton color="error" variant="ghost" icon="i-solar-trash-bin-trash-bold-duotone" size="md" @click="deleteCard(card)" />
				</div>
			</li>
		</ul>

		<!-- Pagination -->
		<div v-if="filteredCards.length > pageSize" class="flex justify-between items-center mt-4">
			<div class="text-sm text-gray-400">
				Showing {{ (currentPage - 1) * pageSize + 1 }}-{{ Math.min(currentPage * pageSize, filteredCards.length) }} of {{ filteredCards.length }} cards
			</div>
   <UPagination
				v-model:page="currentPage"
				:total="filteredCards.length"
				:page-count="totalPages"
				:page-size="pageSize"
				class="flex items-center gap-1"
			/>
		</div>

		<!-- Edit Modal -->
		<UModal v-model:open="showEditModal">
				<template #header>
					<h3 class="text-lg font-medium">Edit Card</h3>
				</template>
			<template #body>
				<div class="space-y-4">
					<UTextarea
						v-model="newCardText"
						placeholder="Enter card text..."
						class="w-full"
						:rows="5"
						autofocus
					/>
				</div>
			</template>
				<template #footer>
					<div class="flex justify-end gap-2">
						<UButton color="neutral" variant="soft" @click="showEditModal = false">
							Cancel
						</UButton>
						<UButton color="primary" @click="saveCardEdit" :disabled="!newCardText.trim()">
							Save Changes
						</UButton>
					</div>
				</template>
		</UModal>
	</div>
</template>
