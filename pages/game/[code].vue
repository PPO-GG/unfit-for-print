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
import { useSfx } from '~/composables/useSfx';
import { ID, Permission, Role, Query } from 'appwrite';
import {useGameSettings} from '~/composables/useGameSettings';
import type {GameSettings} from '~/types/gamesettings';
import type {Lobby} from '~/types/lobby';
import type {Player} from '~/types/player';
import {useAppwrite} from "~/composables/useAppwrite";

definePageMeta({
	layout: 'game'
})
const route = useRoute()
const code = route.params.code as string
const { data: lobby } = await useAsyncData(`lobby-${code}`, () =>
		$fetch<Lobby>(`/api/lobby/${code}`)
)
const config = useRuntimeConfig()
const { playSfx } = useSfx();
const selfLeaving = ref(false);
const router = useRouter();
const userStore = useUserStore();
const players = ref<Player[]>([]);
const loading = ref(true);
const showJoinModal = ref(false);
const joinedLobby = ref(false);
const isStarting = ref(false);
const gameSettings = ref<GameSettings | null>(null);
const isSidebarOpen = ref(false);
const {notify} = useNotifications();
const {getGameSettings, createDefaultGameSettings} = useGameSettings();

// Make lobby and players available to the layout
const nuxtApp = useNuxtApp();
watch(lobby, (newLobby) => {
  if (newLobby) {
    nuxtApp.payload.state.lobby = newLobby;
  }
}, { immediate: true });

watch(players, (newPlayers) => {
  if (newPlayers) {
    nuxtApp.payload.state.players = newPlayers;
  }
}, { immediate: true });

// Initialize selfLeaving flag in Nuxt payload state
nuxtApp.payload.state.selfLeaving = false;

// Watch for changes in the selfLeaving flag
watch(() => nuxtApp.payload.state.selfLeaving, (newSelfLeaving) => {
  if (newSelfLeaving !== undefined) {
    selfLeaving.value = newSelfLeaving;
  }
}, { immediate: true });
const { playerHands, subscribeToGameCards } = useGameCards();
const {
	getLobbyByCode,
	leaveLobby,
	getActiveLobbyForUser,
	markPlayerReturnedToLobby,
	startGame,
} = useLobby();
const {encodeGameState, decodeGameState} = useGameState();
const {getPlayersForLobby} = usePlayers();
const {initSessionIfNeeded} = useJoinLobby();
const {isPlaying, isWaiting, isComplete, isJudging, leaderboard, isRoundEnd, roundWinner, roundEndStartTime, roundEndCountdownDuration, myId, state, myHand, hands} = useGameContext(lobby, computed(() => playerHands.value));

// Check if the current user is the host
const isHost = computed(() => 
    lobby.value?.hostUserId === userStore.user?.$id
);

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

let gameCardsUnsubscribe: () => void;
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

// Simple debounce function to prevent duplicate notifications
const debounce = (func: (...args: any[]) => void, wait: number) => {
	let timeout: ReturnType<typeof setTimeout>;
	return (...args: any[]) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
};

	// Keep track of recently processed player events to avoid duplicates
const recentPlayerEvents = new Map();

// Longer debounce time for leave notifications to prevent multiple notifications
const LEAVE_DEBOUNCE_TIME = 5000; // 5 seconds


// Set up real-time listener for game settings changes
const setupGameSettingsRealtime = (lobbyId: string) => {
	const {client} = getAppwrite();
	const config = useRuntimeConfig();

	// Subscribe to changes in the game settings collection for this lobby
	const unsubscribeGameSettings = client.subscribe(
		[`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwriteGameSettingsCollectionId}.documents`],
		async ({payload}) => {
			// Check if this is a game settings document for our lobby
			const settings = payload as GameSettings;
			// Handle case where lobbyId is a relationship object
			const settingsLobbyId = typeof settings.lobbyId === 'object' && settings.lobbyId?.$id 
				? settings.lobbyId.$id 
				: settings.lobbyId;

			if (settingsLobbyId === lobbyId) {
				console.log('[Realtime] Game settings updated:', settings);
				gameSettings.value = settings;

				// If you're not the host and settings changed, show a notification
				if (!isHost.value) {
					notify({
						title: 'Game Settings Updated',
						description: 'The host has updated the game settings.',
						icon: 'i-solar-info-circle-bold-duotone',
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

const setupRealtime = async (lobbyData: Lobby) => {
	console.log('🔌 Setting up realtime for lobby:', lobbyData.$id);
	const {client} = getAppwrite();
	const { databases } = useAppwrite();
	const config = useRuntimeConfig();
	const lobbyId = lobbyData.$id;
	// initial fetch
	players.value = await getPlayersForLobby(lobbyId);
	console.log('🔌 Initial players:', players.value);

	// Fetch game settings
	try {
		// Try to get existing settings
		const settings = await getGameSettings(lobbyId);

		// If no settings exist and user is host, create default settings
		if (!settings && isHost.value) {
			gameSettings.value = await createDefaultGameSettings(
				lobbyId,
				`${userStore.user?.name || 'Anonymous'}'s Game`,
				userStore.user?.$id // Pass the host user ID
			);
		} else {
			gameSettings.value = settings;
		}

		// Set up real-time listener for game settings changes
		setupGameSettingsRealtime(lobbyId);
	} catch (err) {
		console.error('Failed to load game settings:', err);
	}

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

	// Create debounced versions of notification functions with longer delay (2000ms)
	const debouncedJoinNotification = debounce(async (player: Player) => {
		await playSfx('/sounds/sfx/playerJoin.wav');
		notify({
			title: `${player.name} joined the lobby`,
			color: 'success',
			icon: 'i-mdi-account-plus',
		});
		// Only the host should send system messages to avoid duplicates
		if (isHost.value) {
			await sendSystemMessage(`${player.name} joined the lobby`);
		}
	}, 2000);

	const debouncedLeaveNotification = debounce(async (player: Player) => {
		await playSfx('/sounds/sfx/playerJoin.wav', { pitch: 0.8 });
		notify({
			title: `${player.name} left the lobby`,
			color: 'warning',
			icon: 'i-mdi-account-remove',
		});
		// Only the host should send system messages to avoid duplicates
		if (isHost.value) {
			await sendSystemMessage(`${player.name} left the lobby`);
		}
	}, LEAVE_DEBOUNCE_TIME);

	const unsubscribePlayers = client.subscribe(
			[playersTopic],
			async ({events, payload}) => {
				const player = payload as Player;

				// Validate that the player object has all required properties
				if (!player || !player.userId || !player.lobbyId || !player.name) {
					console.error('Invalid player object in event:', player);
					return;
				}

				// Extract the event type (create, update, delete) from the event string
				const eventType = events[0].split('.').pop();

				// Generate a unique key for this player event using userId, event type, and lobbyId
				// This ensures events for different lobbies are treated separately
				const eventKey = `${player.userId}-${eventType}-${player.lobbyId}`;

				// Check if we've recently processed this event
				const now = Date.now();
				const recentEvent = recentPlayerEvents.get(eventKey);
				if (recentEvent && now - recentEvent < LEAVE_DEBOUNCE_TIME) {
					// Skip if we've processed this event recently
					console.log(`Skipping duplicate event for ${player.name} (${eventType})`);
					return;
				}

				// Record this event as processed
				recentPlayerEvents.set(eventKey, now);

				// Clean up old events (older than the debounce time)
				// This ensures we don't accumulate stale events in memory
				for (const [key, timestamp] of recentPlayerEvents.entries()) {
					if (now - timestamp > LEAVE_DEBOUNCE_TIME) {
						recentPlayerEvents.delete(key);
					}
				}

				// Limit the size of the recentPlayerEvents map to prevent memory issues
				if (recentPlayerEvents.size > 100) {
					console.warn('Too many recent player events, clearing oldest events');
					// Convert to array, sort by timestamp, and keep only the 50 most recent
					const entries = Array.from(recentPlayerEvents.entries());
					entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp (newest first)
					recentPlayerEvents.clear();
					entries.slice(0, 50).forEach(([key, timestamp]) => {
						recentPlayerEvents.set(key, timestamp);
					});
				}

				// Check if this is a create event (new player joining)
				const isCreate = events.some(e => e.endsWith('.create'));

				// Handle case where player.lobbyId is a relationship object
				const playerLobbyId = typeof player.lobbyId === 'object' && player.lobbyId?.$id 
					? player.lobbyId.$id 
					: player.lobbyId;

				// If it's a new player joining this lobby (and not the current user)
				if (isCreate && playerLobbyId === lobbyId && player.userId !== userStore.user?.$id) {
					debouncedJoinNotification(player);
				}

				// 1️⃣ If it’s a delete event for *your* player doc, redirect immediately
				// Check if it's a delete event specifically for the player collection
				const isDelete = events.some(e => e.endsWith('.delete') && e.includes(config.public.appwritePlayerCollectionId));
				if (isDelete && playerLobbyId === lobbyId && player.userId !== userStore.user?.$id) {
					// Check if this player is actually in our current list of players
					// This prevents duplicate notifications for players who have already left
					const isPlayerInList = players.value.some(p => p.userId === player.userId);
					if (isPlayerInList) {
						debouncedLeaveNotification(player);
					} else {
						console.log(`Ignoring leave event for player ${player.name} who is not in the current player list`);
					}
				}
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
				// Use the playerLobbyId we already extracted above
				if (playerLobbyId === lobbyId) {
					console.log('👥 player event:', events, player);
					players.value = await getPlayersForLobby(lobbyId);
				}
			}
	);

 // Function to send system messages to chat
	const sendSystemMessage = async (message: string) => {
		const config = useRuntimeConfig();
		const dbId = config.public.appwriteDatabaseId;
		const messagesCollectionId = config.public.appwriteGamechatCollectionId;

		try {
			await databases.createDocument(dbId, messagesCollectionId, ID.unique(), {
				lobbyId: lobbyId,
				senderId: 'system',
				senderName: 'System',
				text: [message],
				timestamp: new Date().toISOString()
			}, [Permission.read(Role.any())]);
		} catch (error) {
			console.error('Error sending system message:', error);
		}
	};

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
							lobby.value!.$id,
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

		// First check if the lobby with this code exists
		const fetchedLobby = await getLobbyByCode(code);
		if (!fetchedLobby) {
			notify({title: 'Lobby Not Found', color: 'error', icon: 'i-mdi-alert-circle'});
			return router.replace('/join?error=not_found');
		}

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
				// If we have a valid lobby code in the URL, skip the join modal
				// This helps when the page is refreshed and the session is lost
				const isRefresh = window.performance && 
					window.performance.navigation && 
					window.performance.navigation.type === 1;

				if (isRefresh) {
					// On refresh, we'll skip the join modal and let the user rejoin
					console.log('Page was refreshed, skipping join modal');
				} else {
					// Not a refresh, show the join modal
					showJoinModal.value = true;
					return;
				}
			}
		}

		// Set the lobby and continue
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

const ensureGameSettings = async () => {
	if (!gameSettings.value || !gameSettings.value.$id) {
		try {
			// Try to get existing settings
			const settings = await getGameSettings(lobby.value!.$id);

			// If no settings exist and user is host, create default settings
			if (!settings && isHost.value) {
				gameSettings.value = await createDefaultGameSettings(
						lobby.value!.$id,
						`${userStore.user?.name || 'Anonymous'}'s Game`,
						userStore.user?.$id
				);
			} else if (settings) {
				gameSettings.value = settings;
			} else {
				throw new Error('Could not initialize game settings');
			}
		} catch (err) {
			console.error('Failed to initialize game settings:', err);
			notify({
				title: 'Settings Error',
				description: 'Could not initialize game settings.',
				color: 'error',
				icon: 'i-mdi-alert-circle'
			});
		}
	}
};

// Function to start the game
const startGameWrapper = async () => {
	if (!lobby.value) return;

	// Check if game settings exist and have an ID
	if (!gameSettings.value || !gameSettings.value.$id) {
		console.error('Game settings not properly initialized');
		notify({
			title: 'Cannot Start Game',
			description: 'Game settings are not properly initialized. Please try refreshing the page.',
			color: 'error',
			icon: 'i-mdi-alert-circle'
		});
		return;
	}

	try {
		isStarting.value = true;

		// Ensure game settings are initialized
		await ensureGameSettings();

		// Now start the game with the initialized settings
		await startGame(lobby.value.$id, { ...toRaw(gameSettings.value) });
	} catch (err) {
		console.error('Failed to start game:', err);
		isStarting.value = false;
	}
};

// Handle game settings update
const handleSettingsUpdate = (newSettings: GameSettings) => {
	gameSettings.value = newSettings;
};

// Function to convert a spectator to a participant
const convertToParticipant = async (playerId: string) => {
  if (!isHost.value) return;

  try {
    // 1. Update player type in database
    const playerDoc = players.value.find(p => p.userId === playerId);
    if (!playerDoc) return;

    const { databases } = getAppwrite();
    const config = useRuntimeConfig();

    await databases.updateDocument(
      config.public.appwriteDatabaseId,
      config.public.appwritePlayerCollectionId,
      playerDoc.$id,
      {
        playerType: 'participant'
      }
    );

    // 2. Deal cards to the player
    // Get a fresh hand from the white deck

    // Get the game cards document
    const gameCardsRes = await databases.listDocuments(
      config.public.appwriteDatabaseId,
      config.public.appwriteGamecardsCollectionId,
      [Query.equal('lobbyId', lobby.value?.$id)]
    );

    if (gameCardsRes.total === 0) return;

    const gameCards = gameCardsRes.documents[0];
    const whiteDeck = gameCards.whiteDeck || [];

    // Get the number of cards per player from game state
    const cardsPerPlayer = state.value?.config?.cardsPerPlayer || 7;

    // Take cards from the deck
    const newHand = whiteDeck.slice(0, cardsPerPlayer);
    const remainingDeck = whiteDeck.slice(cardsPerPlayer);

    // Update player hands in the game cards document
    const playerHands = gameCards.playerHands || [];
    const parsedHands = playerHands.map(hand => JSON.parse(hand));

    // Add or update the player's hand
    const existingHandIndex = parsedHands.findIndex(h => h.playerId === playerId);
    if (existingHandIndex >= 0) {
      parsedHands[existingHandIndex].cards = newHand;
    } else {
      parsedHands.push({ playerId, cards: newHand });
    }

    // Update the game cards document
    await databases.updateDocument(
      config.public.appwriteDatabaseId,
      config.public.appwriteGamecardsCollectionId,
      gameCards.$id,
      {
        whiteDeck: remainingDeck,
        playerHands: parsedHands.map(hand => JSON.stringify(hand))
      }
    );

    notify({
      title: 'Player Dealt In',
      description: `${getPlayerName(playerId)} is now participating in the game.`,
      color: 'success',
      icon: 'i-mdi-account-plus'
    });

  } catch (err) {
    console.error('Failed to convert player to participant:', err);
    notify({
      title: 'Error',
      description: 'Failed to deal in player.',
      color: 'error',
      icon: 'i-mdi-alert'
    });
  }
};

const copied = ref(false)
function copyLobbyLink() {
	const config = useRuntimeConfig()
	navigator.clipboard.writeText(config.public.baseUrl + '/game/' + lobby.value?.code)
		.then(() => {
			notify({
				title: 'Lobby Code Copied',
				description: 'The lobby code has been copied to your clipboard.',
				color: 'success',
				icon: 'i-mdi-clipboard-check'
			})
		})
		.catch(err => {
			console.error('Failed to copy lobby code:', err)
			notify({
				title: 'Copy Failed',
				description: 'Failed to copy the lobby code.',
				color: 'error',
				icon: 'i-mdi-alert-circle'
			})
		})
	copied.value = true

	setTimeout(() => {
		copied.value = false
	}, 2000)
}
</script>

<template>
	<div class="bg-slate-900 text-white">
		<div v-if="loading">Loading game...</div>

		<!-- Show join modal if user isn't in the game -->
		<div v-if="showJoinModal" class="flex flex-col justify-center items-center min-h-screen">
			<JoinLobbyForm
					:initial-code="code"
					@joined="handleJoinSuccess"
			/>
		</div>

		<!-- Game sidebar - visible in all game phases except join modal -->
		<div v-if="!showJoinModal && lobby && players" class="flex h-screen overflow-hidden">
			<!-- Mobile menu button -->
			<UButton
				icon="i-solar-hamburger-menu-broken"
				color="neutral"
				variant="ghost"
				size="xl"
				@click="isSidebarOpen = true"
				class="xl:hidden absolute left-6 translate-y-[50%] z-10"
				aria-label="Open menu"
			/>

			<!-- Desktop sidebar - hidden on mobile and medium screens -->
			<aside class="max-w-1/4 w-auto h-screen p-4 flex-col shadow-inner border-r border-slate-800 bg-slate-900 space-y-4 overflow-scroll hidden xl:flex z-10">
				<div class="font-['Bebas_Neue'] text-2xl rounded-xl xl:p-4 lg:p-2 shadow-lg w-full mx-auto flex justify-between items-center border-2 border-slate-500 bg-slate-600">
					<!-- Desktop: Lobby Code label + button -->
					<span class="items-center hidden sm:flex">
						Lobby Code:
						</span>
					<UButtonGroup>
							<UButton
									class="text-slate-100 text-xl ml-2"
									:color="copied ? 'success' : 'secondary'"
									:icon="copied ? 'i-solar-clipboard-check-bold-duotone' : 'i-solar-copy-bold-duotone'"
									variant="subtle"
									aria-label="Copy to clipboard"
									@click="copyLobbyLink">
								{{ lobby.code }}
							</UButton>

						<!-- Mobile: Just the icon -->
						<span class="flex sm:hidden">
							<UButton aria-label="Copy Lobby Code" color="info" icon="i-solar-copy-bold-duotone" variant="subtle"/>
						</span>

						<!-- Leave Button (shows on all sizes) -->
						<UButton
								class="cursor-pointer text-white"
								color="error"
								size="xl"
								variant="subtle"
								trailing-icon="i-solar-exit-bold-duotone"
								@click="handleLeave"
						>
							<span class="hidden xl:inline">Leave Game</span>
						</UButton>
					</UButtonGroup>
				</div>
				<PlayerList
						:allow-moderation="true"
						:hostUserId="lobby.hostUserId"
						:lobbyId="lobby.$id"
						:players="players"
						:judgeId="state?.judgeId"
						:submissions="state?.submissions"
						:gamePhase="state?.phase"
						:scores="state?.scores"
						@convert-spectator="convertToParticipant"
				/>
        <ChatBox
						v-if="lobby && lobby.$id"
						:current-user-id="myId"
						:lobbyId="lobby.$id"
				/>
				<div v-if="isWaiting">
					<div class="font-['Bebas_Neue'] text-2xl rounded-xl xl:p-4 lg:p-2 shadow-lg w-full mx-auto flex justify-between items-center border-2 border-slate-500 bg-slate-600">
						<div v-if="players.length >= 3">
							<UButton
									v-if="isHost && !isStarting"
									icon="i-lucide-play"
									@click="startGameWrapper"
									size="lg"
									color="success"
									class="w-full text-black font-['Bebas_Neue'] text-xl"
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
							<p v-if="!isHost && !isStarting" class="text-gray-400 text-center font-['Bebas_Neue'] text-2xl">
								Waiting for the host to start...
							</p>
							<p v-if="!isHost && isStarting" class="text-green-400 text-center font-['Bebas_Neue'] text-2xl">
								Game is starting...
							</p>
						</div>
						<div v-else>
							<p class="text-amber-400 text-center font-['Bebas_Neue'] text-xl">We need at least 3 players to start the
								game!</p>
						</div>
					</div>
					<!-- Game Settings (moved to sidebar bottom) -->
					<GameSettings
						v-if="gameSettings"
						:host-user-id="lobby.hostUserId"
						:is-editable="isHost"
						:lobby-id="lobby.$id"
						:settings="gameSettings"
						@update:settings="handleSettingsUpdate"
						class="mt-4"
					/>
				</div>
			</aside>

			<!-- Mobile Slideover -->
			<USlideover v-model:open="isSidebarOpen" class="xl:hidden" side="left">
				<template #content>
					<div class="p-4 flex flex-col h-full space-y-4 overflow-auto">
						<div class="flex justify-between items-center">
							<h2 class="font-['Bebas_Neue'] text-2xl">Game Menu</h2>
							<UButton
								icon="i-lucide-x"
								color="neutral"
								variant="ghost"
								size="xl"
								@click="isSidebarOpen = false"
								aria-label="Close menu"
							/>
						</div>

						<div class="font-['Bebas_Neue'] text-2xl rounded-xl p-4 shadow-lg w-full mx-auto flex justify-between items-center border-2 border-slate-500 bg-slate-600">
							<span class="items-center flex">
								Lobby Code:
							</span>
							<UButton
								class="text-slate-100 text-xl ml-2"
								:color="copied ? 'success' : 'secondary'"
								:icon="copied ? 'i-solar-clipboard-check-bold-duotone' : 'i-solar-copy-bold-duotone'"
								variant="subtle"
								aria-label="Copy to clipboard"
								@click="copyLobbyLink">
								{{ lobby.code }}
							</UButton>
						</div>

						<UButton
							class="cursor-pointer text-white"
							color="error"
							size="xl"
							block
							variant="soft"
							trailing-icon="i-solar-exit-bold-duotone"
							@click="handleLeave"
						>
							Leave Game
						</UButton>

						<PlayerList
							:allow-moderation="true"
							:hostUserId="lobby.hostUserId"
							:lobbyId="lobby.$id"
							:players="players"
							:judgeId="state?.judgeId"
							:submissions="state?.submissions"
							:gamePhase="state?.phase"
							:scores="state?.scores"
							@convert-spectator="convertToParticipant"
						/>

						<ChatBox
							v-if="lobby && lobby.$id"
							:current-user-id="myId"
							:lobbyId="lobby.$id"
						/>

						<div v-if="isWaiting">
							<div class="font-['Bebas_Neue'] text-2xl rounded-xl p-4 shadow-lg w-full mx-auto flex justify-between items-center border-2 border-slate-500 bg-slate-600">
								<div v-if="players.length >= 3" class="w-full">
									<UButton
										v-if="isHost && !isStarting"
										icon="i-lucide-play"
										@click="startGameWrapper"
										size="lg"
										color="success"
										class="w-full text-black font-['Bebas_Neue'] text-xl"
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
									<p v-if="!isHost && !isStarting" class="text-gray-400 text-center font-['Bebas_Neue'] text-2xl">
										Waiting for the host to start...
									</p>
									<p v-if="!isHost && isStarting" class="text-green-400 text-center font-['Bebas_Neue'] text-2xl">
										Game is starting...
									</p>
								</div>
								<div v-else>
									<p class="text-amber-400 text-center font-['Bebas_Neue'] text-xl">We need at least 3 players to start the
										game!</p>
								</div>
							</div>
							<!-- Game Settings (moved to sidebar bottom) -->
							<GameSettings
								v-if="gameSettings"
								:host-user-id="lobby.hostUserId"
								:is-editable="isHost"
								:lobby-id="lobby.$id"
								:settings="gameSettings"
								@update:settings="handleSettingsUpdate"
								class="mt-4"
							/>
						</div>
					</div>
				</template>
			</USlideover>


			<!-- Main content area -->
			<div class="flex-1">
				<!-- Waiting room view -->
				<WaitingRoom
						v-if="isWaiting && lobby && players"
						:lobby="lobby"
						:players="players"
						:sidebar-moved="true"
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
			</div>
		</div>

		<!-- Game complete - Show waiting room if player has returned to lobby -->
		<div v-if="isComplete && hasReturnedToLobby && lobby && players" class="flex-1">
			<WaitingRoom
					:lobby="lobby"
					:players="players"
					:sidebar-moved="true"
					@leave="handleLeave"
			/>
		</div>

		<!-- Game complete - Show scoreboard if player hasn't returned to lobby -->
		<div v-else-if="isComplete && lobby && players" class="flex-1 max-w-4xl mx-auto py-8 px-4">
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
