<template>
	<div class="font-['Bebas_Neue'] bg-slate-600 rounded-xl xl:p-4 lg:p-2 shadow-lg w-full mx-auto border-2 border-slate-500">
		<h2 class="text-2xl font-bold mb-4">Game Settings</h2>

		<UForm :state="localSettings" class="flex flex-col gap-6" @submit.prevent="saveSettings">
			<template v-if="isEditable">
				<UFormField label="Lobby Name" name="lobbyName">
					<UInput v-model="localSettings.lobbyName" placeholder="My Awesome Game" />
				</UFormField>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<UFormField label="Max Points to Win" name="maxPoints">
						<UInput v-model.number="localSettings.maxPoints" type="number" min="1" max="50" />
					</UFormField>

					<UFormField label="Cards Per Player" name="numPlayerCards">
						<UInput v-model.number="localSettings.numPlayerCards" type="number" min="5" max="20" />
					</UFormField>
				</div>

				<UFormField name="isPrivate">
					<UCheckbox v-model="localSettings.isPrivate" label="Require Password to Join" />
				</UFormField>

				<UFormField
						v-if="localSettings.isPrivate"
						label="Lobby Password"
						name="password"
						hint="Used for joining private lobbies"
				>
					<UInput v-model="localSettings.password" placeholder="Enter password" />
				</UFormField>

				<UFormField label="Card Packs" name="cardPacks">
					<USelectMenu
							v-model="localSettings.cardPacks"
							multiple
							:items="availablePacks"
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
					<UButton color="primary" type="submit">Save Settings</UButton>
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
import { ref, computed, watch } from 'vue'
import type { GameSettings } from '~/types/gamesettings'
import { useGameSettings } from '~/composables/useGameSettings'
import { useNotifications } from '~/composables/useNotifications'

const { notify } = useNotifications()

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

const availablePacks = ref([
	'CAH Base Set',
	'CAH Blue Box Expansion'
])

const saveSettings = async () => {
	try {
		await saveGameSettings(props.lobbyId, localSettings.value, props.hostUserId)
		emit('update:settings', localSettings.value)
		notify({
			title: 'Settings Updated',
			description: 'Game settings have been successfully updated.',
			icon: 'i-solar-check-read-line-duotone',
			color: 'success'
		})
	} catch (err) {
		console.error(err)
		notify({
			title: 'Update Failed',
			description: 'Could not save game settings.',
			icon: 'i-solar-danger-circle-bold-duotone',
			color: 'error'
		})
	}
}

const readOnlyMap = {
	lobbyName: 'Lobby Name',
	maxPoints: 'Max Points',
	numPlayerCards: 'Cards Per Player',
	isPrivate: 'Private Lobby',
	password: 'Password',
	cardPacks: 'Card Packs'
}

const formatValue = (key: keyof GameSettings) => {
	const value = props.settings[key]
	if (key === 'isPrivate') return value ? 'Yes' : 'No'
	if (key === 'cardPacks' && Array.isArray(value)) return value.join(', ');
	return value
}
</script>