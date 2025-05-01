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
	</div>
	<div v-else>
		<p class="text-red-400 text-sm">Lobby data is unavailable.</p>
	</div>
</template>

<script lang="ts" setup>
import {computed} from 'vue';
import {useRouter} from 'vue-router';
import {useUserStore} from '~/stores/userStore';
import {useLobby} from '~/composables/useLobby';
import type {Lobby} from '~/types/lobby';
import type {Player} from '~/types/player';
import PlayerList from "~/components/PlayerList.vue";

const props = defineProps<{ lobby: Lobby; players: Player[] }>()
const lobbyRef = ref(props.lobby)
// Keep lobbyRef in sync with props.lobby
watch(() => props.lobby, (newLobby) => {
	lobbyRef.value = newLobby
}, {immediate: true})

const router = useRouter();
const userStore = useUserStore();
const {startGame, leaveLobby} = useLobby();
const myId = userStore.user?.$id ?? ''
const isHost = computed(() =>
		props.lobby?.hostUserId === userStore.user?.$id
);

const isStarting = ref(false);

const startGameWrapper = async () => {
	if (!props.lobby) return;
	try {
		isStarting.value = true;
		await startGame(props.lobby.$id);  // Remove hostUserId parameter
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

<style scoped>
</style>
