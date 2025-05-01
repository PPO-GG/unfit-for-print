<script lang="ts" setup>
import {onMounted, onUnmounted, ref} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {useUserStore} from '~/stores/userStore';
import {useLobby} from '~/composables/useLobby';
import {usePlayers} from '~/composables/usePlayers';
import {useNotifications} from '~/composables/useNotifications';
import {useJoinLobby} from '~/composables/useJoinLobby';
import {useGameContext} from '~/composables/useGameContext';
import {isAuthenticatedUser} from '~/composables/useUserUtils';
import {useGameState} from "~/composables/useGameState";
import {useGameCards} from "~/composables/useGameCards";
import RoundEndOverlay from '~/components/game/RoundEndOverlay.vue'; // Import the new component
import type {Lobby} from '~/types/lobby';
import type {Player} from '~/types/player';

definePageMeta({
	layout: 'game'
})
const route = useRoute()
const code = route.params.code as string

const { data: lobby } = await useAsyncData(`lobby-${code}`, () =>
		$fetch<Lobby>(`/api/lobby/${code}`)
)

const config = useRuntimeConfig()

useHead({
	title: `Unfit for Print | Game ${code}`,
	meta: [
		{ name: 'description', content: 'Join the chaos in Unfit for Print – a Cards Against Humanity-inspired party game!' },
		{ property: 'og:site_name', content: 'Unfit for Print' },
		{ property: 'og:title', content: `Unfit for Print - Game ${code}` },
		{ property: 'og:description', content: lobby.value?.hostUserId ? `Hosted by ${lobby.value?.hostUserId}` : 'A hilarious and chaotic web game. Join this lobby and play with friends!' },
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
const selfLeaving = ref(false);
const router = useRouter();
const userStore = useUserStore();
const players = ref<Player[]>([]);
const loading = ref(true);
const showJoinModal = ref(false);
const joinedLobby = ref(false);

const {notify} = useNotifications();
const { playerHands, subscribeToGameCards } = useGameCards();
let gameCardsUnsubscribe: () => void;
const {
	getLobbyByCode,
	leaveLobby,
	getActiveLobbyForUser,
	markPlayerReturnedToLobby,
} = useLobby();
const {encodeGameState, decodeGameState} = useGameState();
const {getPlayersForLobby} = usePlayers();
const {initSessionIfNeeded} = useJoinLobby();
const {isPlaying, isWaiting, isComplete, isJudging, leaderboard, isRoundEnd, roundWinner, roundEndStartTime, roundEndCountdownDuration, myId, state, myHand, hands} = useGameContext(lobby, computed(() => playerHands.value));

// Check if the current player has returned to the lobby
const hasReturnedToLobby = computed(() => {
	if (!state.value || !myId || state.value.phase !== 'complete') return false;
	return state.value.returnedToLobby && state.value.returnedToLobby[myId.value];
});

// Calculate time remaining for auto-return (60 seconds)
const autoReturnTimeRemaining = computed(() => {
	if (!state.value || !state.value.gameEndTime) return 60;
	const timeElapsed = Math.floor((Date.now() - state.value.gameEndTime) / 1000);
	return Math.max(0, 60 - timeElapsed);
});

const setupRealtime = async (lobbyData: Lobby) => {
	console.log('🔌 Setting up realtime for lobby:', lobbyData.$id);
	const {client} = getAppwrite();
	const config = useRuntimeConfig();
	const lobbyId = lobbyData.$id;
	// initial fetch
	players.value = await getPlayersForLobby(lobbyId);
	console.log('🔌 Initial players:', players.value);

	// 🧠 Lobby Realtime
	const unsubscribeLobby = client.subscribe(
			[`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwriteLobbyCollectionId}.documents.${lobbyData.$id}`],
			async ({events, payload}) => {
				console.log('📡 [Lobby Event]', events, payload);

				if (events.some(e => e.endsWith('.delete'))) {
					notify({title: 'Lobby Deleted', color: 'error', icon: 'i-mdi-alert-circle'});
					await router.replace('/');
				}

				// Update lobby data when it changes
				if (events.some(e => e.endsWith('.update'))) {
					// Create a new lobby object to trigger reactivity
					lobby.value = {...payload as Lobby};
					console.log('📡 [Lobby Updated]', lobby.value);
				}
			}
	);

	// 👥 Player Realtime
	const playersTopic = `databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwritePlayerCollectionId}.documents`;

	const unsubscribePlayers = client.subscribe(
			[playersTopic],
			async ({events, payload}) => {
				// 1️⃣ If it’s a delete event for *your* player doc, redirect immediately
				const isDelete = events.some(e => e.endsWith('.delete'));
				if (isDelete && (payload as Player).userId === userStore.user!.$id) {
					if (selfLeaving.value) {
						// you clicked Leave
						notify({
							title: 'You left the lobby',
							color: 'info',
							icon: 'i-mdi-exit-run',
						});
					} else {
						// someone else kicked you
						notify({
							title: 'You were kicked from the lobby',
							color: 'error',
							icon: 'i-mdi-account-remove',
						});
					}

					// reset the flag so future deletes act normally
					selfLeaving.value = false;

					return router.replace('/');
				}

				// 2️⃣ Otherwise, if it’s for *this* lobby, re‑fetch the list
				const player = payload as Player;
				if (player.lobbyId === lobbyId) {
					console.log('👥 player event:', events, player);
					players.value = await getPlayersForLobby(lobbyId);
				}
			}
	);

	// 🃏 Game Cards Realtime
	gameCardsUnsubscribe = subscribeToGameCards(lobbyId, (cards) => {
		console.log('📡 [GameCards Updated]', cards);
	});

	// Clean up all subscriptions
	onUnmounted(() => {
		unsubscribeLobby();
		unsubscribePlayers();
		gameCardsUnsubscribe();
	});
};


// Timer to periodically check if all players have returned or if the auto-return timer has expired
const autoReturnCheckInterval = ref<NodeJS.Timeout | null>(null);

// Function to start the auto-return check timer
const startAutoReturnCheck = () => {
	// Clear any existing interval
	if (autoReturnCheckInterval.value) {
		clearInterval(autoReturnCheckInterval.value);
	}

	// Set up a new interval to check every second
	autoReturnCheckInterval.value = setInterval(async () => {
		if (lobby.value && isComplete.value) {
			// Update the timer display
			// When timer reaches 0, automatically mark the player as returned to the lobby
			if (autoReturnTimeRemaining.value <= 0 && !hasReturnedToLobby.value && myId.value) {
				await markPlayerReturnedToLobby(lobby.value.$id, myId.value);

				notify({
					title: 'Auto-returned to lobby',
					description: 'The timer expired and you were automatically returned to the lobby',
					color: 'info',
					icon: 'i-mdi-clock-check'
				});
			}
		} else if (autoReturnCheckInterval.value) {
			// If the game is no longer complete, clear the interval
			clearInterval(autoReturnCheckInterval.value);
		}
	}, 1000);
};

// Clean up the interval when the component is unmounted
onUnmounted(() => {
	if (autoReturnCheckInterval.value) {
		clearInterval(autoReturnCheckInterval.value);
	}
});

// Watch for changes to isComplete to start/stop the auto-return check
watch(isComplete, (newIsComplete) => {
	if (newIsComplete && lobby.value?.status === 'complete') {
		// Game just completed, initialize the gameEndTime if needed
		if (state.value && !state.value.gameEndTime) {
			// Update the game state to set the gameEndTime, but don't mark the player as returned
			const { databases } = getAppwrite();
			const config = useRuntimeConfig();

			try {
				// Get the current lobby
				databases.getDocument(
					config.public.appwriteDatabaseId,
					config.public.appwriteLobbyCollectionId,
					lobby.value.$id
				).then(lobbyDoc => {
					// Decode the current game state
					const gameState = decodeGameState(lobbyDoc.gameState);

					// Set gameEndTime if it's not already set
					if (!gameState.gameEndTime) {
						gameState.gameEndTime = Date.now();

						// Update the game state in the database
						databases.updateDocument(
							config.public.appwriteDatabaseId,
							config.public.appwriteLobbyCollectionId,
							lobby.value.$id,
							{
								gameState: encodeGameState(gameState)
							}
						).catch(err => {
							console.error('Failed to update gameEndTime:', err);
						});
					}
				}).catch(err => {
					console.error('Failed to get lobby document:', err);
				});
			} catch (err) {
				console.error('Failed to initialize gameEndTime:', err);
			}
		}
		// Start the auto-return check
		startAutoReturnCheck();
	} else if (autoReturnCheckInterval.value) {
		// Game is no longer complete, clear the interval
		clearInterval(autoReturnCheckInterval.value);
	}
});

onMounted(async () => {
	loading.value = true;

	try {
		await initSessionIfNeeded();
		await userStore.fetchUserSession();

		const user = userStore.user;
		if (!user) {
			showJoinModal.value = true;
			return;
		}

		// Check if user is the creator of the lobby (from URL query param)
		// Only allow authenticated users to use the creator parameter
		const isCreator = route.query.creator === 'true' && isAuthenticatedUser(user);

		// Check if the user is already in an active lobby, regardless of whether they're anonymous or authenticated
		if (!isCreator) {
			const activeLobby = await getActiveLobbyForUser(user.$id);
			if (activeLobby && activeLobby.code === code) {
				// User is already in this lobby, proceed without showing join modal
			} else if (activeLobby) {
				// User is in a different active lobby, redirect them there
				notify({title: 'Redirecting to your active game', color: 'info', icon: 'i-mdi-controller'});
				return router.replace(`/game/${activeLobby.code}`);
			} else {
				// User is not in any active lobby, show join modal
				showJoinModal.value = true;
				return;
			}
		}

		const fetchedLobby = await getLobbyByCode(code);
		if (!fetchedLobby) {
			notify({title: 'Lobby Not Found', color: 'error', icon: 'i-mdi-alert-circle'});
			return router.replace('/join?error=not_found');
		}
		lobby.value = fetchedLobby;
		joinedLobby.value = true;
		await setupRealtime(fetchedLobby);

	} catch (err) {
		console.error('❌ onMounted error:', err);
		notify({title: 'Failed to load game page', color: 'error', icon: 'i-mdi-alert-circle'});
		await router.replace('/');
	} finally {
		loading.value = false;
	}
});

const handleJoinSuccess = async (joinedCode: string) => {

	const fetchedLobby = await getLobbyByCode(joinedCode);
	if (!fetchedLobby) {
		notify({title: 'Lobby Not Found', color: 'error', icon: 'i-mdi-alert-circle'});
		return;
	}
	lobby.value = fetchedLobby;
	await setupRealtime(fetchedLobby);
	showJoinModal.value = false;
	joinedLobby.value = true;
};

const handleCardSubmit = (cardId: string) => {
	console.log('🃏 submitCard:', cardId);
};

const handleWinnerSelect = (cardId: string) => {
	console.log('🏆 selectWinner:', cardId);
};

const handleLeave = async () => {
	if (!lobby.value || !userStore.user?.$id) return;

	// mark that *we* are leaving
	selfLeaving.value = true;

	// Call the leaveLobby function to handle player document deletion
	// and update game state if needed
	await leaveLobby(lobby.value.$id, userStore.user.$id);

	// navigate away
	return router.replace('/');
};

const handleDrawBlackCard = () => {
	console.log('🖤 drawBlackCard');
};

const getPlayerName = (playerId: string | null): string | null => { // Allow null playerId
	if (!playerId) return null;
	const player = players.value.find(p => p.userId === playerId);
	return player?.name || 'Unknown Player'; // Keep fallback for safety
};

const handleContinue = async () => {
	if (!lobby.value || !myId) return;

	try {
		// Mark this player as returned to the lobby without affecting others
		await markPlayerReturnedToLobby(lobby.value.$id, myId.value);

		// No need to check if all players have returned anymore
		// Each player will individually transition to the waiting room

		notify({
			title: 'You returned to the lobby',
			description: 'Other players can still view the scoreboard',
			color: 'success',
			icon: 'i-mdi-check-circle'
		});
	} catch (err) {
		console.error('Failed to return to lobby:', err);
		notify({
			title: 'Failed to return to lobby',
			color: 'error',
			icon: 'i-mdi-alert-circle'
		});
	}
};
</script>

<template>
	<div class="bg-slate-900 text-white">
		<div v-if="loading">Loading game...</div>

		<!-- Show join modal if user isn't in the game -->
		<JoinLobbyForm
				v-if="showJoinModal"
				:initial-code="code"
				@joined="handleJoinSuccess"
		/>

		<!-- Waiting room view -->
		<WaitingRoom
				v-else-if="isWaiting && lobby && players"
				:lobby="lobby"
				:players="players"
				@leave="handleLeave"
		/>

		<!-- In-game view -->
		<GameBoard
				v-else-if="(isPlaying || isJudging || isRoundEnd) && lobby && players"
				:lobby="lobby"
				:players="players"
				:white-card-texts="{}"
				@leave="handleLeave"
				@submit-card="handleCardSubmit"
				@select-winner="handleWinnerSelect"
				@draw-black-card="handleDrawBlackCard"
		/>

		<!-- Game complete - Show waiting room if player has returned to lobby -->
		<WaitingRoom
				v-if="isComplete && hasReturnedToLobby && lobby && players"
				:lobby="lobby"
				:players="players"
				@leave="handleLeave"
		/>

		<!-- Game complete - Show scoreboard if player hasn't returned to lobby -->
		<div v-else-if="isComplete && lobby && players" class="max-w-4xl mx-auto py-8 px-4">
			<h2 class="text-3xl font-bold text-center mb-6">Game Over</h2>

			<!-- Auto-return timer -->
			<div class="bg-slate-700 rounded-lg p-4 mb-6 text-center">
				<p class="text-lg text-gray-300">Returning to lobby in</p>
				<p class="text-4xl font-bold text-white">{{ autoReturnTimeRemaining }} seconds</p>
			</div>

			<!-- Winner display -->
			<div class="bg-slate-800 rounded-lg p-6 mb-8 text-center">
				<h3 class="text-2xl font-bold mb-4">Winner</h3>
				<div v-if="leaderboard.length > 0" class="flex flex-col items-center">
					<div class="text-yellow-400 text-5xl mb-2">🏆</div>
					<div class="text-2xl font-bold text-yellow-400">
						{{ getPlayerName(leaderboard[0].playerId) }}
					</div>
					<div class="text-xl mt-2">
						{{ leaderboard[0].points }} points
					</div>
				</div>
			</div>

			<!-- Leaderboard -->
			<div class="bg-slate-800 rounded-lg p-6 mb-8">
				<h3 class="text-xl font-bold mb-4 text-center">Final Scores</h3>
				<div class="space-y-2">
					<div v-for="(entry, index) in leaderboard" :key="entry.playerId"
					     :class="index === 0 ? 'bg-yellow-900/30' : 'bg-slate-700/50'"
					     class="flex justify-between items-center p-2 rounded">
						<div class="flex items-center">
							<span class="w-8 text-center">{{ index + 1 }}</span>
							<span>{{ getPlayerName(entry.playerId) }}</span>
						</div>
						<span class="font-bold">{{ entry.points }} pts</span>
					</div>
				</div>
			</div>

			<!-- Continue button -->
			<div class="text-center mt-8">
				<UButton
						color="primary"
						icon="i-lucide-arrow-right"
						size="lg"
						@click="handleContinue"
				>
					Continue to Lobby
				</UButton>
			</div>
		</div>

		<!-- Round End Overlay - Don't show if we're transitioning to the scoreboard -->
		<RoundEndOverlay
				v-if="isRoundEnd && lobby && !isComplete"
				:countdown-duration="roundEndCountdownDuration"
				:is-host="lobby.hostUserId === myId"
				:is-winner-self="roundWinner === myId"
				:lobby-id="lobby.$id"
				:start-time="roundEndStartTime"
				:winner-name="getPlayerName(roundWinner)"
		/>

		<!-- Catch-all fallback -->
		<div v-else-if="!lobby"> <!-- Only show fallback if lobby truly failed to load -->
			<p>Could not load the game state.</p>
		</div>
	</div>
</template>
