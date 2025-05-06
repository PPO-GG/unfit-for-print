<template>
	<div class="game-settings bg-slate-800 rounded-lg p-6 space-y-6 mb-4">
		<h2 class="text-2xl font-bold">Game Settings</h2>

		<UForm :state="localSettings" class="space-y-6">
			<!-- Editable settings form -->
			<div v-if="isEditable" class="space-y-6">
				<!-- Basic Settings -->
				<UFormGroup label="Lobby Name" name="lobbyName">
					<UInput v-model="localSettings.lobbyName" placeholder="My Awesome Game" />
				</UFormGroup>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<UFormGroup label="Max Points to Win" name="maxPoints">
						<UInput v-model.number="localSettings.maxPoints" type="number" min="1" max="50" />
					</UFormGroup>

					<UFormGroup label="Cards Per Player" name="numPlayerCards">
						<UInput v-model.number="localSettings.numPlayerCards" type="number" min="5" max="20" />
					</UFormGroup>

					<UFormGroup label="Private Lobby" name="isPrivate">
						<UCheckbox v-model="localSettings.isPrivate" label="Require Password to Join" />
					</UFormGroup>

					<!-- Password field only if lobby is private -->
					<UFormGroup
							v-if="localSettings.isPrivate"
							label="Lobby Password"
							name="password"
							hint="Used for joining private lobbies"
					>
						<UInput v-model="localSettings.password" placeholder="Enter password" />
					</UFormGroup>
				</div>

				<!-- Card Packs Selection -->
				<UFormGroup label="Card Packs" name="cardPacks">
					<div class="grid grid-cols-2 gap-2">
						<UCheckbox v-model="useBaseCardPack" label="Base Pack" />
						<!-- Add more packs here in the future -->
					</div>
				</UFormGroup>

				<!-- Save Button -->
				<div class="flex justify-end">
					<UButton color="primary" @click="saveSettings">Save Settings</UButton>
				</div>
			</div>

			<!-- Read-only settings display -->
			<div v-else class="text-sm grid grid-cols-2 gap-x-6 gap-y-3 text-gray-300">
				<template v-for="(label, key) in readOnlyMap" :key="key">
					<div class="flex justify-between">
						<span class="text-gray-400">{{ label }}:</span>
						<span>{{ formatValue(key) }}</span>
					</div>
				</template>
			</div>
		</UForm>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import type { GameSettings } from '~/types/gamesettings';
import { useGameSettings } from '~/composables/useGameSettings';
import { useNotifications } from '~/composables/useNotifications';

const { notify } = useNotifications();

const props = defineProps<{
	settings: GameSettings;
	isEditable: boolean;
	lobbyId: string;
	hostUserId?: string;
}>();

const emit = defineEmits<{
	(e: 'update:settings', settings: GameSettings): void;
}>();

const { saveGameSettings } = useGameSettings();
const localSettings = ref<GameSettings>({ ...props.settings });

watch(() => props.settings, (newVal) => {
	localSettings.value = { ...newVal };
}, { deep: true });

const useBaseCardPack = computed({
	get: () => localSettings.value.cardPacks.includes('base'),
	set: (val) => {
		localSettings.value.cardPacks = val
				? [...new Set([...localSettings.value.cardPacks, 'base'])]
				: localSettings.value.cardPacks.filter(p => p !== 'base');
	},
});

const saveSettings = async () => {
	try {
		await saveGameSettings(props.lobbyId, localSettings.value, props.hostUserId);
		emit('update:settings', localSettings.value);
		notify({
			title: 'Settings Updated',
			description: 'Game settings have been successfully updated.',
			icon: 'i-heroicons-check-circle',
			color: 'success',
		});
	} catch (err) {
		console.error(err);
		notify({
			title: 'Update Failed',
			description: 'Could not save game settings.',
			icon: 'i-heroicons-exclamation-circle',
			color: 'error',
		});
	}
};

// For read-only display
const readOnlyMap = {
	lobbyName: 'Lobby Name',
	maxPoints: 'Max Points',
	numPlayerCards: 'Cards Per Player',
	isPrivate: 'Private Lobby',
	password: 'Password',
	cardPacks: 'Card Packs'
};

const formatValue = (key: keyof GameSettings) => {
	const value = props.settings[key];
	if (key === 'isPrivate') return value ? 'Yes' : 'No';
	if (key === 'cardPacks') return value.join(', ');
	return value;
};
</script>