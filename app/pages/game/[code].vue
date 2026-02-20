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
import {useGameActions} from "~/composables/useGameActions";
import {useSfx} from '~/composables/useSfx';
import GameOver from '~/components/game/GameOver.vue';
import type {Client, Databases} from 'appwrite';
import {ID, Permission, Query, Role} from 'appwrite';
import {getAppwrite} from '~/utils/appwrite';
import {useGameSettings} from '~/composables/useGameSettings';
import type {GameSettings} from '~/types/gamesettings';
import type {Lobby} from '~/types/lobby';
import type {Player} from '~/types/player';
import {useI18n} from 'vue-i18n'

const { t } = useI18n()
let client: Client | undefined
let databases: Databases | undefined
if (import.meta.client) {
  ({ client, databases } = getAppwrite())
}

definePageMeta({
	layout: 'game'
})
const route = useRoute()
const code = route.params.code as string
const lobby = ref<Lobby | null>(null)
const config = useRuntimeConfig()
const { playSfx } = useSfx();
const { selectWinner, startNextRound } = useGameActions();
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
const {isPlaying, isWaiting, isComplete, isJudging, leaderboard, isRoundEnd, roundWinner, roundEndStartTime, roundEndCountdownDuration, myId, state} = useGameContext(lobby, computed(() => playerHands.value));

// Create a local reactive variable to track the round winner (similar to GameBoard.vue)
const localRoundWinner = ref<string | null>("");

// Also create a local variable to store winning cards in case they're not in the state
const localWinningCards = ref<string[] | null>([]);

// Computed property that combines both state.roundWinner and localRoundWinner
const effectiveRoundWinner = computed(() => {
  return (localRoundWinner.value && localRoundWinner.value !== "") ? localRoundWinner.value : (roundWinner || null);
});

// Computed property to get the winning cards, with fallback to local storage
const effectiveWinningCards = computed(() => {
  // Ensure winner is a string, not a ComputedRef
  const winner = typeof effectiveRoundWinner.value === 'object' 
    ? (effectiveRoundWinner.value as any)?.value 
    : effectiveRoundWinner.value;

  if (!winner || winner === "") {
    console.log('No winner available for winning cards');
    return [];
  }

  // Debug information
  console.log('Looking for winning cards for winner:', winner);
  console.log('Winner type:', typeof winner);
  console.log('State submissions:', state.value?.submissions);

  // First try to get from state - use a direct check for the winner's submission
  if (winner && state.value?.submissions && state.value.submissions[winner]) {
    const stateCards = state.value.submissions[winner];
    if (Array.isArray(stateCards) && stateCards.length > 0) {
      console.log('Using winning cards from state:', stateCards);
      return stateCards;
    }
  }

  // If we can't find the cards for the winner directly, try to find them by partial match
  if (state.value?.submissions) {
    for (const [playerId, cards] of Object.entries(state.value.submissions)) {
      if ((typeof winner === 'string' && (playerId.includes(winner) || winner.includes(playerId))) && Array.isArray(cards) && cards.length > 0) {
        console.log('Found winning cards by partial ID match:', cards);
        return cards;
      }
    }
  }

  // Fall back to local storage
  if (localWinningCards.value && Array.isArray(localWinningCards.value) && localWinningCards.value.length > 0) {
    console.log('Using winning cards from local storage:', localWinningCards.value);
    return localWinningCards.value;
  }

  // If all else fails, try to find any valid submission in the game state
  if (state.value?.submissions) {
    // First try to find the submission with the most cards (likely the correct one)
    let bestSubmission: string[] | null = null;
    let maxCards = 0;

    for (const [_, cards] of Object.entries(state.value.submissions)) {
      if (Array.isArray(cards) && cards.length > maxCards) {
        bestSubmission = cards;
        maxCards = cards.length;
      }
    }

    if (bestSubmission && bestSubmission.length > 0) {
      console.log('Using submission with most cards as fallback:', bestSubmission);
      return bestSubmission;
    }

    // If we still don't have a submission, use any valid submission
    for (const [_, cards] of Object.entries(state.value.submissions)) {
      if (Array.isArray(cards) && cards.length > 0) {
        console.log('Using first available submission as fallback:', cards);
        return cards;
      }
    }
  }

  // If we still can't find any cards, log an error and return an empty array
  if (typeof window !== 'undefined') {
    console.log('No winning cards found, returning empty array');
  }
  return [];
});

// Watch for changes to roundWinner to update localRoundWinner and localWinningCards
watch(() => roundWinner, (newWinner) => {
  if (newWinner) {
    // Reset local round winner when state is updated from the server
    localRoundWinner.value = "";

    // Log for debugging (only on client side)
    if (typeof window !== 'undefined') {
      console.log('Round winner updated from server:', newWinner);
    }

    // Get the submissions for this winner
    const winnerCards = state.value?.submissions?.[newWinner];

    // Log submissions (only on client side)
    if (typeof window !== 'undefined') {
      console.log('Submissions for winner:', winnerCards);
    }

    // Store the winning cards locally if they're available
    if (winnerCards && Array.isArray(winnerCards) && winnerCards.length > 0) {
      localWinningCards.value = winnerCards;
      if (typeof window !== 'undefined') {
        console.log('Stored local winning cards from roundWinner update:', localWinningCards.value);
      }
    } else {
      // Ensure localWinningCards is always an array
      localWinningCards.value = [];
    }
  }
});

// Watch for changes to submissions to ensure we have the latest data
watch(() => state.value?.submissions, (newSubmissions) => {
  if (newSubmissions && (roundWinner || localRoundWinner.value)) {
    // Ensure winner is a string, not a ComputedRef
    const winner = typeof effectiveRoundWinner.value === 'object' 
      ? (effectiveRoundWinner.value as any)?.value 
      : effectiveRoundWinner.value;

    if (winner) {
      // Safely access submissions using the winner ID
      const winnerSubmission = winner ? newSubmissions[winner] : undefined;

      if (typeof window !== 'undefined') {
        console.log('Submissions updated, winner cards:', winnerSubmission);
        console.log('Winner type:', typeof winner);
      }

      // If we have submissions for the winner but no local winning cards, store them
      if (winnerSubmission && Array.isArray(winnerSubmission) && winnerSubmission.length > 0 && 
          (!localWinningCards.value || !Array.isArray(localWinningCards.value) || localWinningCards.value.length === 0)) {
        localWinningCards.value = winnerSubmission;
        if (typeof window !== 'undefined') {
          console.log('Stored local winning cards from submissions update:', localWinningCards.value);
        }
      }
    }
  }
}, { deep: true });

// Watch for changes to effectiveWinningCards
watch(() => effectiveWinningCards.value, (newCards) => {
  // Only log on client side
  if (typeof window !== 'undefined') {
    console.log('Effective winning cards changed:', newCards);
  }
}, { immediate: true });

// Function to handle selecting a winner (similar to GameBoard.vue)
function handleWinnerSelect(playerId: string) {
  // First mark the winner locally to show the animation
  localRoundWinner.value = playerId;

  // Debug information
  console.log('handleWinnerSelect called with playerId:', playerId);
  console.log('Current state:', state.value);
  console.log('Current submissions:', state.value?.submissions);

  // Store the winning cards locally if they're available in the state
  if (state.value?.submissions?.[playerId] && Array.isArray(state.value.submissions[playerId])) {
    localWinningCards.value = state.value.submissions[playerId];
    console.log('Found winning cards in state for playerId:', playerId, localWinningCards.value);
  } else {
    console.log('No winning cards found in state for playerId:', playerId);
    console.log('Attempting to find cards by partial match...');

    // Try to find by partial match
    let found = false;
    if (state.value?.submissions) {
      for (const [submissionPlayerId, cards] of Object.entries(state.value.submissions)) {
        if ((submissionPlayerId.includes(playerId) || playerId.includes(submissionPlayerId)) && Array.isArray(cards) && cards.length > 0) {
          localWinningCards.value = cards;
          console.log('Found winning cards by partial match:', submissionPlayerId, cards);
          found = true;
          break;
        }
      }
    }

    if (!found) {
      // Ensure localWinningCards is always an array
      localWinningCards.value = [];
      console.log('No winning cards found by any method, setting empty array');
    }
  }

  // Log for debugging (only on client side)
  if (typeof window !== 'undefined') {
    console.log('Local round winner set:', playerId);
    console.log('Local winning cards set:', localWinningCards.value);
  }

  // Update the database immediately so all players see the winning card
  // This will trigger the transition to roundEnd phase
  if (lobby.value?.$id) {
    selectWinner(lobby.value.$id, playerId)
      .then(() => {
        console.log('Winner selected in database:', playerId);
        // Play sound effect
        playSfx('/sounds/sfx/selectWinner.wav', {pitch: [0.95, 1.05], volume: 0.75});
      })
      .catch((err) => {
        console.error('Failed to select winner:', err);
      });
  }
}

// Check if the current user is the host
const isHost = computed(() => {
    const hostId = lobby.value?.hostUserId;
    const userId = userStore.user?.$id;

    // Make sure both IDs are defined before comparing
    if (!hostId || !userId) {
        return false;
    }

    // Try direct comparison first
    if (hostId === userId) {
        return true;
    }

    // Try partial matching if direct comparison fails
    // This handles cases where the ID format might be different
    if (typeof hostId === 'string' && typeof userId === 'string') {
        return hostId.includes(userId) || userId.includes(hostId);
    }

    return false;
});

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
	if (!state.value || !myId.value || state.value.phase !== 'complete') return false;
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
        if (!client) return
        const config = useRuntimeConfig();

	// Subscribe to changes in the game settings collection for this lobby
	return client.subscribe(
			[`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwriteGameSettingsCollectionId}.documents`],
			async ({payload}) => {
				// Check if this is a game settings document for our lobby
				const settings = payload as GameSettings;
				// Handle case where lobbyId is a relationship object
				const settingsLobbyId = typeof settings.lobbyId === 'object' && settings.lobbyId?.$id
						? settings.lobbyId.$id
						: settings.lobbyId;

				if (settingsLobbyId === lobbyId) {
					gameSettings.value = settings;

					// If you're not the host and settings changed, show a notification
					if (!isHost.value) {
						notify({
							title: t('game.settings.updated'),
							icon: 'i-solar-info-circle-bold-duotone',
							color: 'primary',
							duration: 3000
						});
					}
				}
			}
	);
};

const setupRealtime = async (lobbyData: Lobby) => {
        if (!client || !databases) return
        const config = useRuntimeConfig();
        const lobbyId = lobbyData.$id;
	// initial fetch
	players.value = await getPlayersForLobby(lobbyId);

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
		const unsubscribeGameSettings = setupGameSettingsRealtime(lobbyId);
	} catch (err) {
		console.error('Failed to load game settings:', err);
	}

	// 🧠 Lobby Realtime
	const unsubscribeLobby = client.subscribe(
			[`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwriteLobbyCollectionId}.documents.${lobbyData.$id}`],
			async ({events, payload}) => {

				if (events.some(e => e.endsWith('.delete'))) {
					notify({title: t('lobby.lobbydeleted'), color: 'error', icon: 'i-mdi-alert-circle'});
					await router.replace('/');
				}

				// Update lobby data when it changes
				if (events.some(e => e.endsWith('.update'))) {
					// Create a new lobby object to trigger reactivity
					lobby.value = {...payload as Lobby};
				}
			}
	);

	// 👥 Player Realtime
	const playersTopic = `databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwritePlayerCollectionId}.documents`;

	// Create debounced versions of notification functions with longer delay (2000ms)
	const debouncedJoinNotification = debounce(async (player: Player) => {
		await playSfx('/sounds/sfx/playerJoin.wav');
		notify({
			title: t('lobby.player_joined', { name: player.name }),
			color: 'success',
			icon: 'i-mdi-account-plus',
		});
		// Only the host should send system messages to avoid duplicates
		if (isHost.value) {
			await sendSystemMessage(t('lobby.player_joined', { name: player.name }));
		}
	}, 2000);

	const debouncedLeaveNotification = debounce(async (player: Player) => {
		await playSfx('/sounds/sfx/playerJoin.wav', { pitch: 0.8 });
		notify({
			title: t('lobby.player_left', { name: player.name }),
			color: 'warning',
			icon: 'i-mdi-account-remove',
		});
		// Only the host should send system messages to avoid duplicates
		if (isHost.value) {
			await sendSystemMessage(t('lobby.player_left', { name: player.name }));
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
					return;
				}

				// Record this event as processed
				recentPlayerEvents.set(eventKey, now);

				// Clean up old events (older than the debounce time)
				// This ensures we don't accumulate stale events in memory
				for (const [key, timeStamp] of recentPlayerEvents.entries()) {
					if (now - timeStamp > LEAVE_DEBOUNCE_TIME) {
						recentPlayerEvents.delete(key);
					}
				}

				// Limit the size of the recentPlayerEvents map to prevent memory issues
				if (recentPlayerEvents.size > 100) {
					console.warn('Too many recent player events, clearing oldest events');
					// Convert to array, sort by timestamp, and keep only the 50 most recent
					const entries = Array.from(recentPlayerEvents.entries());
					entries.sort((a, b) => b[1] - a[1]); // Sort by timeStamp (newest first)
					recentPlayerEvents.clear();
					entries.slice(0, 50).forEach(([key, timeStamp]) => {
						recentPlayerEvents.set(key, timeStamp);
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

				const isDelete = events.some(e => e.endsWith('.delete') && e.includes(config.public.appwritePlayerCollectionId as string));
				if (isDelete && playerLobbyId === lobbyId && player.userId !== userStore.user?.$id) {
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
							title: t('lobby.you_left'),
							color: 'info',
							icon: 'i-mdi-exit-run',
						});
					} else {
						// someone else kicked you
						notify({
							title: t('lobby.you_were_kicked'),
							color: 'error',
							icon: 'i-mdi-account-remove',
						});
					}

					// reset the flag so future deletes act normally
					selfLeaving.value = false;

					return router.replace('/');
				}

				if (playerLobbyId === lobbyId) {
					players.value = await getPlayersForLobby(lobbyId);
				}
			}
	);

 // Function to send system messages to chat
	const sendSystemMessage = async (message: string) => {
		const config = useRuntimeConfig();
		const dbId = config.public.appwriteDatabaseId as string;
		const messagesCollectionId = config.public.appwriteGamechatCollectionId as string;
		const maxLength = 255; // Maximum length for text field

		try {
			// Ensure message is a string and truncate if needed
			const safeMessage = true
				? message.substring(0, maxLength) 
				: String(message).substring(0, maxLength);

			await databases.createDocument(dbId, messagesCollectionId, ID.unique(), {
				lobbyId: lobbyId,
				senderId: 'system',
				senderName: 'System',
				text: safeMessage,
				timeStamp: new Date().toISOString()
			}, [Permission.read(Role.any())]);
		} catch (error) {
			console.error('Error sending system message:', error);
		}
	};

	// 🃏 Game Cards Realtime
	gameCardsUnsubscribe = subscribeToGameCards(lobbyId, (updatedCards) => {
		// When game cards are updated, we need to ensure the UI reflects the changes
		// This will trigger reactivity for components that depend on playerHands
		console.log('Game cards updated:', updatedCards);
	});

	// Clean up all subscriptions
	onUnmounted(() => {
		unsubscribeLobby?.();
		unsubscribePlayers?.();
		gameCardsUnsubscribe?.();
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
					title: t('lobby.return_to_lobby'),
					description: t('lobby.timer_expired_return_description'),
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
                        if (!databases) return
                        const config = useRuntimeConfig();

			try {
				// Get the current lobby
				databases.getDocument(
					config.public.appwriteDatabaseId as string,
					config.public.appwriteLobbyCollectionId as string,
					lobby.value.$id
				).then(lobbyDoc => {
					// Decode the current game state
					const gameState = decodeGameState(lobbyDoc.gameState);

					// Set gameEndTime if it's not already set
					if (!gameState.gameEndTime) {
						gameState.gameEndTime = Date.now();

						// Update the game state in the database
						databases.updateDocument(
							config.public.appwriteDatabaseId as string,
							config.public.appwriteLobbyCollectionId as string,
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

// Watch for changes in game state from waiting to playing
watch(isPlaying, (newIsPlaying) => {
	// If the game state changes to playing, close the sidebar if it's open
	if(newIsPlaying && isSidebarOpen.value){
		isSidebarOpen.value = false;
	}
});

// Watch for changes in game state from waiting to playing
watch(isPlaying, (newIsPlaying) => {
	// If the game state changes to playing, close the sidebar if it's open
	if(newIsPlaying && isSidebarOpen.value){
		isSidebarOpen.value = false;
	}
});

onMounted(async () => {
	const { isMobile } = useDevice()
	const { isSizeMobile } = useDeviceType()
	if((isSizeMobile || isMobile) && isWaiting){
		isSidebarOpen.value = true;
	}
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
			notify({title: t('lobby.not_found'), color: 'error', icon: 'i-mdi-alert-circle'});
			return router.replace('/join?error=not_found');
		}

		// Fetch lobby data using $fetch instead of useAsyncData
		try {
			lobby.value = await $fetch<Lobby>(`/api/lobby/${code}`);
		} catch (error) {
			console.error('Failed to fetch lobby data:', error);
		}

		// Check if the user is already in an active lobby, regardless of whether they're anonymous or authenticated
		if (!isCreator) {
			const activeLobby = await getActiveLobbyForUser(user.$id);
			if (activeLobby && activeLobby.code === code) {
				// User is already in this lobby, proceed without showing join modal
			} else if (activeLobby) {
				// User is in a different active lobby, redirect them there
				notify({title: t('lobby.return_active_game'), color: 'info', icon: 'i-mdi-controller'});
				return router.replace(`/game/${activeLobby.code}`);
			} else {
				// If we have a valid lobby code in the URL, skip the join modal
				// This helps when the page is refreshed and the session is lost
				let isRefresh = false;

				// Only check for refresh on client side
				if (typeof window !== 'undefined') {
					isRefresh = window.performance &&
							window.performance && window.performance.getEntriesByType &&
							window.performance.getEntriesByType('navigation')[0]?.type === 'reload';
				}

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
		console.error(err);
		notify({title: t('lobby.failed_loading_game'), color: 'error', icon: 'i-mdi-alert-circle'});
		await router.replace('/');
	} finally {
		loading.value = false;
	}
});

const handleJoinSuccess = async (joinedCode: string) => {

	const fetchedLobby = await getLobbyByCode(joinedCode);
	if (!fetchedLobby) {
		notify({title: t('lobby.not_found'), color: 'error', icon: 'i-mdi-alert-circle'});
		return;
	}
	lobby.value = fetchedLobby;
	await setupRealtime(fetchedLobby);
	showJoinModal.value = false;
	joinedLobby.value = true;
};

const handleCardSubmit = () => {
	return
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
	return
};

// Add handler for when round is started
const handleRoundStarted = async () => {
    console.log('Round started, refreshing game state');
    if (lobby.value?.$id) {
        // Re-fetch game cards and update state
        await $fetch<Lobby>(`/api/lobby/${code}`).then(updatedLobby => {
            if (updatedLobby) {
                lobby.value = updatedLobby;
            }
        }).catch(err => {
            console.error('Failed to refresh lobby data:', err);
        });

        // Play a sound effect if available
        playSfx('nextRound');
    }
};

const getPlayerName = (playerId: string | null): string => { // Allow null playerId
	if (!playerId || playerId === "") return t('lobby.unknown_player');

	// First try to find the player in the players array by userId
	const player = players.value.find(p => p.userId === playerId);
	if (player?.name) {
		return player.name;
	}

	// If not found, try to find by partial match (in case the ID format is different)
	const partialMatch = players.value.find(p => 
		(typeof p.userId === 'string' && typeof playerId === 'string' && 
		(p.userId.includes(playerId) || playerId.includes(p.userId)))
	);
	if (partialMatch?.name) {
		return partialMatch.name;
	}

	// If still not found, check if the playerId is in the state.players object
	if (state.value?.players && state.value.players[playerId]) {
		return state.value.players[playerId];
	}

	// Try to find by matching with any key in the submissions object
	if (state.value?.submissions) {
		for (const submissionPlayerId of Object.keys(state.value.submissions)) {
			if (typeof submissionPlayerId === 'string' && typeof playerId === 'string' &&
				(submissionPlayerId.includes(playerId) || playerId.includes(submissionPlayerId))) {
				// Try to find this player in the players array
				const matchingPlayer = players.value.find(p => 
					typeof p.userId === 'string' && 
					(p.userId.includes(submissionPlayerId) || submissionPlayerId.includes(p.userId))
				);
				if (matchingPlayer?.name) {
					return matchingPlayer.name;
				}
			}
		}
	}

	// Check if this is the current user
	if (myId.value && typeof myId.value === 'string' && typeof playerId === 'string' &&
		(myId.value.includes(playerId) || playerId.includes(myId.value))) {
		return t('game.you'); // Return "You" for the current user
	}

	// Last resort fallback
	return t('lobby.unknown_player');
};

const handleContinue = async () => {
	if (!lobby.value || !myId.value) return;

	try {
		// Mark this player as returned to the lobby without affecting others
		await markPlayerReturnedToLobby(lobby.value.$id, myId.value);

		// No need to check if all players have returned anymore
		// Each player will individually transition to the waiting room

		notify({
			title: t('lobby.return_to_lobby'),
			description: t('lobby.scoreboard_return_description'),
			color: 'success',
			icon: 'i-mdi-check-circle'
		});
	} catch (err) {
		console.error('Failed to return to lobby:', err);
		notify({
			title: t('lobby.failed_return_to_lobby'),
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
				title: t('lobby.settings_error'),
				description: t('lobby.settings_init_error'),
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
			title: t('lobby.cant_start_game'),
			description: t('lobby.settings_init_error'),
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

// Function to convert a spectator to a player
const convertToPlayer = async (playerId: string) => {
  if (!isHost.value) return;

  try {
    // 1. Update player type in database
    const playerDoc = players.value.find(p => p.userId === playerId);
    if (!playerDoc) return;

    if (!databases) return;
    const config = useRuntimeConfig();

    await databases.updateDocument(
      config.public.appwriteDatabaseId as string,
      config.public.appwritePlayerCollectionId as string,
      playerDoc.$id,
      {
        playerType: 'player'
      }
    );

    // 2. Deal cards to the player
    // Get a fresh hand from the white deck

    // Check if lobby ID is available
    if (!lobby.value || !lobby.value.$id) {
      console.error('Cannot convert player: Lobby ID is undefined');
      notify({
        title: t('game.error_player_dealt_in'),
        description: t('game.lobby_id_missing'),
        color: 'error',
        icon: 'i-mdi-alert'
      });
      return;
    }

    // Get the game cards document
    const gameCardsRes = await databases.listDocuments(
      config.public.appwriteDatabaseId as string,
      config.public.appwriteGamecardsCollectionId,
      [Query.equal('lobbyId', lobby.value.$id)]
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
      config.public.appwriteDatabaseId as string,
      config.public.appwriteGamecardsCollectionId as string,
      gameCards.$id,
      {
        whiteDeck: remainingDeck,
        playerHands: parsedHands.map(hand => JSON.stringify(hand))
      }
    );

    notify({
      title: t('game.player_dealt_in'),
      description: t('game.player_dealt_in_description', { name: getPlayerName(playerId) }),
      color: 'success',
      icon: 'i-mdi-account-plus'
    });

  } catch (err) {
    console.error('Failed to convert player to participant:', err);
    notify({
      title: t('game.error_player_dealt_in'),
      color: 'error',
      icon: 'i-mdi-alert'
    });
  }
};

const copied = ref(false)
function copyLobbyLink() {
	// Skip if not on client side
	if (typeof window === 'undefined') return;

	const config = useRuntimeConfig()
	navigator.clipboard.writeText(config.public.baseUrl + '/game/' + lobby.value?.code)
		.then(() => {
			notify({
				title: t('lobby.code_copied'),
				color: 'success',
				icon: 'i-mdi-clipboard-check'
			})
		})
		.catch(err => {
			console.error('Failed to copy lobby code:', err)
			notify({
				title: t('lobby.error_code_copied'),
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
		<LoadingOverlay :is-loading="loading" :message="t('game.loading_game')" />

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
			<aside class="max-w-1/4 w-auto h-screen p-4 flex-col shadow-inner border-r border-slate-800 bg-slate-900 space-y-4 overflow-scroll hidden xl:flex z-10" :overlay="false">
				<div class="font-['Bebas_Neue'] text-2xl rounded-xl xl:p-4 lg:p-2 shadow-lg w-full mx-auto flex justify-between items-center border-2 border-slate-500 bg-slate-600">
					<!-- Desktop: Lobby Code label + button -->
					<span class="items-center hidden sm:flex">
						{{  t('lobby.lobby_code') }}:
						</span>
					<UFieldGroup>
							<UButton
									class="text-slate-100 text-xl ml-2"
									:color="copied ? 'success' : 'secondary'"
									:icon="copied ? 'i-solar-clipboard-check-bold-duotone' : 'i-solar-copy-bold-duotone'"
									variant="subtle"
									aria-label="{{ t('lobby.copy_to_clipboard') }}"
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
							<span class="hidden xl:inline">{{ t('game.leave_game') }}</span>
						</UButton>
					</UFieldGroup>
				</div>
				<PlayerList
						:allow-moderation="true"
						:hostUserId="lobby?.hostUserId || ''"
						:lobbyId="lobby?.$id || ''"
						:players="players"
						:judgeId="state?.judgeId"
						:submissions="state?.submissions"
						:gamePhase="state?.phase"
						:scores="state?.scores"
						@convert-spectator="convertToPlayer"
				/>
        <ChatBox
						v-if="joinedLobby"
						:current-user-id="myId.value"
						:lobbyId="lobby?.$id || ''"
				/>
				<div v-if="isWaiting">
					<div class="font-['Bebas_Neue'] text-2xl rounded-xl xl:p-4 lg:p-2 shadow-lg w-full mx-auto flex justify-between items-center border-2 border-slate-500 bg-slate-600">
						<div v-if="players.length >= 3">
							<UButton
									v-if="isHost && !isStarting"
									icon="i-solar-play-bold"
									@click="startGameWrapper"
									size="lg"
									color="success"
									class="w-full text-black font-['Bebas_Neue'] text-xl"
							>
								{{ t('lobby.start_game') }}
							</UButton>
							<UButton
									v-if="isHost && isStarting"
									:loading="true"
									disabled
							>
								{{ t('lobby.starting_game') }}
							</UButton>
							<p v-if="!isHost && !isStarting" class="text-gray-400 text-center font-['Bebas_Neue'] text-2xl">
								{{ t('lobby.waiting_for_host_start_game') }}
							</p>
							<p v-if="!isHost && isStarting" class="text-green-400 text-center font-['Bebas_Neue'] text-2xl">
								{{ t('lobby.starting_game') }}
							</p>
						</div>
						<div v-else>
							<p class="text-amber-400 text-center font-['Bebas_Neue'] text-xl">{{ t('lobby.players_needed') }}</p>
						</div>
					</div>
					<GameSettings
						v-if="gameSettings"
						:host-user-id="lobby?.hostUserId || ''"
						:is-editable="isHost"
						:lobby-id="lobby?.$id || ''"
						:settings="gameSettings"
						@update:settings="handleSettingsUpdate"
						class="mt-4"
					/>
				</div>
				<div class="w-full flex flex-row gap-2 mt-4 items-center justify-center">
					<LanguageSwitcher />
					<VoiceSwitcher />
					<ThemeSwitcher />
				</div>
			</aside>

			<!-- Mobile Slideover -->
			<USlideover v-model:open="isSidebarOpen" class="xl:hidden" side="left" :overlay="false">
				<template #content>
					<div class="p-4 flex flex-col h-full space-y-4 overflow-auto">
						<div class="flex justify-between items-center">
							<h2 class="font-['Bebas_Neue'] text-2xl">{{ t('game.game_menu') }}</h2>
							<UButton
								icon="i-solar-close-square-bold-duotone"
								color="neutral"
								variant="ghost"
								size="xl"
								@click="isSidebarOpen = false"
								aria-label="{{ t('game.close_menu') }}"
							/>
						</div>

						<div class="font-['Bebas_Neue'] text-2xl rounded-xl p-4 shadow-lg w-full mx-auto flex justify-between items-center border-2 border-slate-500 bg-slate-600">
							<span class="items-center flex">
								{{ t('lobby.lobby_code') }}:
							</span>
							<UButton
								class="text-slate-100 text-xl ml-2"
								:color="copied ? 'success' : 'secondary'"
								:icon="copied ? 'i-solar-clipboard-check-bold-duotone' : 'i-solar-copy-bold-duotone'"
								variant="subtle"
								aria-label="{{ t('lobby.copy_to_clipboard') }}"
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
							:click="handleLeave"
						>
							{{ t('game.leave_game') }}
						</UButton>

						<PlayerList
							:allow-moderation="true"
							:hostUserId="lobby?.hostUserId || ''"
							:lobbyId="lobby?.$id || ''"
							:players="players"
							:judgeId="state?.judgeId"
							:submissions="state?.submissions"
							:gamePhase="state?.phase"
  					:scores="state?.scores"
  					@convert-spectator="convertToPlayer"
						/>

						<ChatBox
							v-if="joinedLobby"
							:current-user-id="myId.value"
							:lobbyId="lobby?.$id || ''"
						/>

						<div v-if="isWaiting">
							<div class="font-['Bebas_Neue'] text-2xl rounded-xl p-4 shadow-lg w-full mx-auto flex justify-between items-center border-2 border-slate-500 bg-slate-600">
								<div v-if="players.length >= 3" class="w-full">
									<UButton
										v-if="isHost && !isStarting"
										icon="i-solar-play-bold"
										@click="startGameWrapper"
										size="lg"
										color="success"
										class="w-full text-black font-['Bebas_Neue'] text-xl"
									>
										{{ t('lobby.start_game') }}
									</UButton>
									<UButton
										v-if="isHost && isStarting"
										:loading="true"
										disabled
									>
										{{ t('lobby.starting_game') }}
									</UButton>
									<p v-if="!isHost && !isStarting" class="text-gray-400 text-center font-['Bebas_Neue'] text-2xl">
										{{ t('lobby.waiting_for_host_start_game') }}
									</p>
									<p v-if="!isHost && isStarting" class="text-green-400 text-center font-['Bebas_Neue'] text-2xl">
										{{ t('lobby.starting_game') }}
									</p>
								</div>
								<div v-else>
									<p class="text-amber-400 text-center font-['Bebas_Neue'] text-xl">{{ t('lobby.players_needed') }}</p>
								</div>
							</div>
							<GameSettings
								v-if="gameSettings"
								:host-user-id="lobby?.hostUserId || ''"
								:is-editable="isHost"
								:lobby-id="lobby?.$id || ''"
								:settings="gameSettings"
								@update:settings="handleSettingsUpdate"
								class="mt-4"
							/>
						</div>
						<div class="w-full mb-4 flex flex-row gap-2 mt-4 items-center justify-center">
							<LanguageSwitcher />
							<VoiceSwitcher />
						</div>
					</div>
				</template>
			</USlideover>


			<!-- Main content area -->
			<div class="flex-1">
				<!-- Waiting room view -->
				<ClientOnly>
					<WaitingRoom
							v-if="isWaiting && lobby && players"
							:lobby="lobby || {}"
							:players="players"
							:sidebar-moved="true"
							@leave="handleLeave"
					/>
				</ClientOnly>

				<!-- In-game view -->
				<ClientOnly v-if="(isPlaying || isJudging || isRoundEnd) && !isComplete && lobby && players">
					<GameBoard
							:lobby="lobby || {}"
							:players="players"
							:white-card-texts="{}"
							@leave="handleLeave"
							@submit-card="handleCardSubmit"
							@select-winner="handleWinnerSelect"
							@draw-black-card="handleDrawBlackCard"
					/>
				</ClientOnly>

				<!-- Game Over view -->
				<ClientOnly v-if="isComplete && !hasReturnedToLobby && lobby && players">
					<GameOver
							:leaderboard="leaderboard"
							:players="players"
							@continue="handleContinue"
					/>
				</ClientOnly>
			</div>
		</div>

		<!-- Game complete - Show waiting room if player has returned to lobby -->
		<div v-if="isComplete && hasReturnedToLobby && lobby && players" class="flex-1">
			<ClientOnly>
				<WaitingRoom
						:lobby="lobby || {}"
						:players="players"
						:sidebar-moved="true"
						@leave="handleLeave"
				/>
			</ClientOnly>
		</div>

		<!-- Round End Overlay - Don't show if we're transitioning to the scoreboard -->
		<ClientOnly>
			<!-- Debug info for host status - hidden -->
			<div v-if="isRoundEnd && lobby && !isComplete" style="display: none;">
				<p>Host status: {{ isHost.value }}</p>
				<p>Lobby host ID: {{ lobby?.hostUserId }}</p>
				<p>My ID: {{ myId.value }}</p>
				<p>User store ID: {{ userStore.user?.$id }}</p>
				<p>isRoundEnd: {{ isRoundEnd }}</p>
				<p>isComplete: {{ isComplete }}</p>
			</div>

			<!-- Round End Overlay -->
			<RoundEndOverlay
					v-if="isRoundEnd && lobby && !isComplete"
					:countdown-duration="roundEndCountdownDuration"
					:is-host="isHost"
					:is-winner-self="myId.value && (typeof effectiveRoundWinner.value === 'object' ? (effectiveRoundWinner.value as any)?.value === myId.value : effectiveRoundWinner.value === myId.value)"
					:lobby-id="lobby?.$id || ''"
					:start-time="roundEndStartTime"
					:winner-name="getPlayerName(typeof effectiveRoundWinner.value === 'object' ? (effectiveRoundWinner.value as any)?.value : effectiveRoundWinner.value)"
					:document-id="gameSettings?.$id || (lobby?.$id ? `settings-${lobby.$id}` : undefined)"
					:winning-cards="state.value?.winningCards || []"
					@round-started="handleRoundStarted"
			/>
		</ClientOnly>

		<!-- Debug info for round end state -->
		<ClientOnly>
			<div v-if="isRoundEnd && lobby && !isComplete" style="display: none;">

			</div>
		</ClientOnly>

		<!-- Catch-all fallback -->
		<div v-if="!lobby"> <!-- Only show fallback if lobby truly failed to load -->
			<p>{{ t('lobby.error_loading_gamestate') }}</p>
		</div>
	</div>
</template>
