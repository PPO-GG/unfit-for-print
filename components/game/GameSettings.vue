<template>
	<div class="font-['Bebas_Neue'] bg-slate-600 rounded-xl xl:p-4 lg:p-2 shadow-lg w-full mx-auto border-2 border-slate-500">
		<h2 class="text-2xl font-bold mb-4">{{ t('game.settings') }}</h2>

		<UForm :state="localSettings" class="flex flex-col gap-6" @submit.prevent="saveSettings">
			<template v-if="isEditable">
				<UFormField :label="t('game.settings.lobby_name')" name="lobbyName">
					<UInput v-model="localSettings.lobbyName" :placeholder="t('game.settings.lobby_name')" />
				</UFormField>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<UFormField :label="t('game.settings.points_to_win')" name="maxPoints">
						<UInput v-model.number="localSettings.maxPoints" type="number" min="1" max="50" />
					</UFormField>

					<UFormField :label="t('game.settings.cards_per_player')" name="numPlayerCards">
						<UInput v-model.number="localSettings.numPlayerCards" type="number" min="5" max="20" />
					</UFormField>
				</div>

				<UFormField name="isPrivate">
					<UCheckbox v-model="localSettings.isPrivate" :label="t('game.settings.is_private')" />
				</UFormField>

				<UFormField
						v-if="localSettings.isPrivate"
						:label="t('game.settings.lobby_password')"
						name="password"
				>
					<UInput v-model="localSettings.password" :placeholder="t('game.settings.lobby_password')" />
				</UFormField>

				<UFormField :label="t('game.settings.card_packs')" name="cardPacks">
     <USelectMenu
							v-model="localSettings.cardPacks"
							multiple
							:items="availablePacks"
							:loading="loadingPacks"
							class="w-full"
					/>
					<div class="flex flex-wrap gap-2 mt-2">
						<UBadge
								v-for="pack in localSettings.cardPacks"
								:key="pack"
								color="info"
								variant="solid"
						>
							{{ pack }}
						</UBadge>
					</div>
				</UFormField>

				<div class="flex justify-end">
					<UButton color="primary" type="submit">{{ t('game.settings.save_settings') }}</UButton>
				</div>
			</template>

			<template v-else>
				<div class="text-sm grid grid-cols-2 gap-x-6 gap-y-3 text-gray-300">
					<template v-for="(label, key) in readOnlyMap" :key="key">
						<div class="flex justify-between">
							<span class="text-gray-400">{{ label }}:</span>
							<span>{{ formatValue(key) }}</span>
						</div>
					</template>
				</div>
			</template>
		</UForm>
	</div>
</template>

<script setup lang="ts">
import {onMounted, ref, watch} from 'vue'
import type {GameSettings} from '~/types/gamesettings'
import {useGameSettings} from '~/composables/useGameSettings'
import {useNotifications} from '~/composables/useNotifications'
import {getAppwrite} from '~/utils/appwrite'
import {Query} from 'appwrite'
import type { Databases } from 'appwrite'

const { t } = useI18n()
const { notify } = useNotifications()
let databases: Databases | undefined
if (import.meta.client) {
  ({ databases } = getAppwrite())
}
const config = useRuntimeConfig()

const props = defineProps<{
	settings: GameSettings
	isEditable: boolean
	lobbyId: string
	hostUserId?: string
}>()

const emit = defineEmits<{
	(e: 'update:settings', settings: GameSettings): void
}>()

const { saveGameSettings } = useGameSettings()
const localSettings = ref<GameSettings>({ ...props.settings })

watch(
		() => props.settings,
		(newVal) => {
			localSettings.value = { ...newVal }
		},
		{ deep: true }
)

const availablePacks = ref<string[]>([])
const loadingPacks = ref(false)

// Define database IDs
const DB_ID = config.public.appwriteDatabaseId
const CARD_COLLECTIONS = {
	black: config.public.appwriteBlackCardCollectionId as string,
	white: config.public.appwriteWhiteCardCollectionId as string
}

// Fetch available card packs on mount
onMounted(async () => {
        if (!databases) return
        loadingPacks.value = true
	try {
		// First get total count of black cards
		const blackCountResult = await databases.listDocuments(DB_ID, CARD_COLLECTIONS.black, [Query.limit(1)])
		const totalBlackCards = blackCountResult.total

		// Fetch all black cards to extract packs (using a reasonable chunk size)
		const chunkSize = 1000
		const blackPacks = new Set<string>()

		for (let offset = 0; offset < totalBlackCards; offset += chunkSize) {
			const blackCardsChunk = await databases.listDocuments(DB_ID, CARD_COLLECTIONS.black, [
				Query.limit(chunkSize),
				Query.offset(offset)
			])

			blackCardsChunk.documents.forEach(card => {
				if (card.pack && !card.disabled) {
					blackPacks.add(card.pack)
				}
			})
		}

		// Now get total count of white cards
		const whiteCountResult = await databases.listDocuments(DB_ID, CARD_COLLECTIONS.white, [Query.limit(1)])
		const totalWhiteCards = whiteCountResult.total

		// Fetch all white cards to extract packs
		const whitePacks = new Set<string>()

		for (let offset = 0; offset < totalWhiteCards; offset += chunkSize) {
			const whiteCardsChunk = await databases.listDocuments(DB_ID, CARD_COLLECTIONS.white, [
				Query.limit(chunkSize),
				Query.offset(offset)
			])

			whiteCardsChunk.documents.forEach(card => {
				if (card.pack && !card.disabled) {
					whitePacks.add(card.pack)
				}
			})
		}

		// Combine and sort packs
		availablePacks.value = [...new Set([...blackPacks, ...whitePacks])].sort()

	} catch (error) {
		// console.error('Error fetching card packs:', error)
		notify({
			title: t('game.settings.fetch_packs_error'),
			icon: 'i-solar-danger-circle-bold-duotone',
			color: 'error'
		})
	} finally {
		loadingPacks.value = false
	}
})

const saveSettings = async () => {
	try {
		await saveGameSettings(props.lobbyId, localSettings.value, props.hostUserId)
		emit('update:settings', localSettings.value)
		notify({
			title: t('game.settings.updated'),
			icon: 'i-solar-check-read-line-duotone',
			color: 'success'
		})
	} catch (err) {
		console.error(err)
		notify({
			title: t('game.settings.update_failed'),
			icon: 'i-solar-danger-circle-bold-duotone',
			color: 'error'
		})
	}
}

const readOnlyMap = {
	lobbyName: t('game.settings.lobby_name'),
	maxPoints: t('game.settings.points_to_win'),
	numPlayerCards: t('game.settings.cards_per_player'),
	isPrivate: t('game.settings.is_private'),
	password: t('game.settings.lobby_password'),
	cardPacks: t('game.settings.card_packs')
}

const formatValue = (key: keyof GameSettings) => {
	const value = props.settings[key]
	if (key === 'isPrivate') return value ? '❌' : '✅'
	if (key === 'cardPacks' && Array.isArray(value)) return value.join(', ');
	return value
}
</script>
