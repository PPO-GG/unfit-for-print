<template>
	<div v-if="lobby" class="flex h-screen bg-gray-900 overflow-hidden">
		<aside class="max-w-3/12 w-auto h-screen p-4 flex flex-col shadow-inner border-r-1 border-slate-800 space-y-4">
			<h1 class="text-2xl font-bold font-['Bebas_Neue'] p-4">
				Lobby Code: {{ lobby.code }}
				<UButton
						class="ml-4 cursor-pointer text-white justify-end"
						color="error"
						size="xl"
						trailing-icon="i-lucide-arrow-right"
						@click="handleLeave"
				>
					Leave Game
				</UButton>
			</h1>
			<PlayerList
					:allow-moderation="true"
					:hostUserId="lobby.hostUserId"
					:lobbyId="lobby.$id"
					:players="players"
			/>
			<ChatBox
					:lobby-id="props.lobby.$id"
					:current-user-id="myId"
			/>
			<div v-if="players.length >= 3">
				<UButton
						v-if="isHost && !isStarting"
						icon="i-lucide-play"
						@click="startGameWrapper"
				>
					Start Game
				</UButton>
				<UButton
						v-if="isHost && isStarting"
						:loading="true"
						disabled
				>
					Starting Game...
				</UButton>
				<p v-if="!isHost && !isStarting" class="text-gray-400 text-center font-['Bebas_Neue'] text-4xl">
					Waiting for the host to start...
				</p>
				<p v-if="!isHost && isStarting" class="text-green-400 text-center font-['Bebas_Neue'] text-4xl">
					Game is starting...
				</p>
			</div>
			<div v-else>
				<p class="text-gray-400 text-center font-['Bebas_Neue'] text-2xl">We need at least 3 players to start the
					game!</p>
			</div>
		</aside>
		<GameSettings
				v-if="gameSettings"
				:settings="gameSettings"
				:is-editable="isHost"
				:lobby-id="lobby.$id"
				:host-user-id="lobby.hostUserId"
				@update:settings="handleSettingsUpdate"
		/>
	</div>
	<div v-else>
		<p class="text-red-400 text-sm">Lobby data is unavailable.</p>
	</div>
</template>

<script lang="ts" setup>
import {computed, onUnmounted} from 'vue';
import {useRouter} from 'vue-router';
import {useUserStore} from '~/stores/userStore';
import {useLobby} from '~/composables/useLobby';
import {getAppwrite} from '~/utils/appwrite';
import type {Lobby} from '~/types/lobby';
import type {Player} from '~/types/player';
import type {GameSettings} from '~/types/gamesettings';
import {useNotifications} from "~/composables/useNotifications";

const { notify } = useNotifications();
const props = defineProps<{ lobby: Lobby; players: Player[] }>()
const lobbyRef = ref(props.lobby)
// Keep lobbyRef in sync with props.lobby
watch(() => props.lobby, (newLobby) => {
	lobbyRef.value = newLobby
}, {immediate: true})

const router = useRouter();
const userStore = useUserStore();
const {startGame, leaveLobby} = useLobby();
const { getGameSettings, createDefaultGameSettings } = useGameSettings();
const myId = userStore.user?.$id ?? ''
const isHost = computed(() =>
		props.lobby?.hostUserId === userStore.user?.$id
);

const isStarting = ref(false);
const gameSettings = ref<GameSettings | null>(null);

// Set up real-time listener for game settings changes
const setupGameSettingsRealtime = () => {
	if (!props.lobby) return;

	const { client } = getAppwrite();
	const config = useRuntimeConfig();

	// Subscribe to changes in the game settings collection for this lobby
	const unsubscribeGameSettings = client.subscribe(
		[`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwriteGameSettingsCollectionId}.documents`],
		async ({ events, payload }) => {
			// Check if this is a game settings document for our lobby
			const settings = payload as GameSettings;
			if (settings.lobbyId === props.lobby.$id) {
				console.log('[Realtime] Game settings updated:', settings);
				gameSettings.value = settings;

				// If you're not the host and settings changed, show a notification
				if (!isHost.value) {
					notify({
						title: 'Game Settings Updated',
						description: 'The host has updated the game settings.',
						icon: 'i-heroicons-information-circle',
						color: 'primary',
						duration: 3000
					});
				}
			}
		}
	);

	// Clean up subscription when component is unmounted
	onUnmounted(() => {
		unsubscribeGameSettings?.();
	});
};

// Fetch game settings when the component is mounted
onMounted(async () => {
	if (props.lobby) {
		try {
			// Try to get existing settings
			const settings = await getGameSettings(props.lobby.$id);

			// If no settings exist and user is host, create default settings
			if (!settings && isHost.value) {
				gameSettings.value = await createDefaultGameSettings(
						props.lobby.$id,
						`${userStore.user?.name || 'Anonymous'}'s Game`,
						userStore.user?.$id // Pass the host user ID
				);
			} else {
				gameSettings.value = settings;
			}

			// Set up real-time listener for game settings changes
			setupGameSettingsRealtime();
		} catch (err) {
			console.error('Failed to load game settings:', err);
		}
	}
});
const handleSettingsUpdate = (newSettings: GameSettings) => {
	gameSettings.value = newSettings;
};

const startGameWrapper = async () => {
	if (!props.lobby) return;
	try {
		isStarting.value = true;
		// Pass game settings to the startGame function
		await startGame(props.lobby.$id, gameSettings.value);
	} catch (err) {
		console.error('Failed to start game:', err);
		isStarting.value = false;
	}
};

const handleLeave = async () => {
	if (!props.lobby || !userStore.user?.$id) return;
	try {
		await leaveLobby(props.lobby.$id, userStore.user.$id);
		await router.push('/');
	} catch (err) {
		console.error('Failed to leave lobby:', err);
	}
};
</script>
