<script lang="ts" setup>
import type {Player} from '~/types/player'
import type {Lobby} from '~/types/lobby'
import {useGameContext} from '~/composables/useGameContext'
import {useGameActions} from '~/composables/useGameActions'
import {useUserStore} from '~/stores/userStore'
import {useLobby} from '~/composables/useLobby'
import {useNotifications} from '~/composables/useNotifications'
import {useGameCards} from '~/composables/useGameCards'
import UserHand from '~/components/game/UserHand.vue'
import whiteCard from '~/components/game/whiteCard.vue'
import {getAppwrite} from "~/utils/appwrite";
import { Query } from "appwrite";

const props = defineProps<{ lobby: Lobby; players: Player[] }>()
const emit = defineEmits<{
	(e: 'leave'): void
}>()

const lobbyRef = ref(props.lobby)
// Keep lobbyRef in sync with props.lobby
watch(() => props.lobby, (newLobby) => {
	lobbyRef.value = newLobby
}, {immediate: true})

// Real-time updates are now handled by the parent component ([code].vue)

// Initialize useGameCards to get player hands
const { playerHands, fetchGameCards, subscribeToGameCards } = useGameCards()

// Variable to store the unsubscribe function
let gameCardsUnsubscribe: (() => void) | null = null;

// Subscribe to game cards updates when the component is mounted
onMounted(() => {
	if (props.lobby?.$id) {
		gameCardsUnsubscribe = subscribeToGameCards(props.lobby.$id, (cards) => {
			console.log('🃏 [GameBoard] Game cards updated:', cards);
		})
	}
})

// Watch for changes to the lobby ID and re-subscribe if needed
watch(() => props.lobby?.$id, (newLobbyId, oldLobbyId) => {
	// Only resubscribe if the lobby ID has changed
	if (newLobbyId && newLobbyId !== oldLobbyId) {
		// Clean up previous subscription if it exists
		if (gameCardsUnsubscribe) {
			gameCardsUnsubscribe();
		}

		// Create new subscription
		gameCardsUnsubscribe = subscribeToGameCards(newLobbyId, (cards) => {
			console.log('🃏 [GameBoard] Game cards updated:', cards);
		})
	}
})

const {
	state,
	isSubmitting,
	isJudging,
	isComplete,
	isJudge,
	myHand,
	submissions,
	otherSubmissions,
	judgeId,
	blackCard,
	leaderboard,
	hands
} = useGameContext(lobbyRef, computed(() => playerHands.value))
const {playSfx} = useSfx();
const {playCard, selectWinner} = useGameActions()
const {leaveLobby} = useLobby()
const userStore = useUserStore()
const myId = userStore.user?.$id ?? ''
const {notify} = useNotifications()

// Add computed properties to check player type
const currentPlayer = computed(() => {
  const player = props.players.find(p => p.userId === myId);
  console.log('GameBoard - currentPlayer:', {
    userId: player?.userId,
    name: player?.name,
    playerType: player?.playerType
  });
  return player;
});

const isParticipant = computed(() => {
  const result = currentPlayer.value?.playerType === 'participant' || !currentPlayer.value?.playerType;
  console.log('GameBoard - isParticipant:', result);
  return result;
});

const isSpectator = computed(() => {
  const result = currentPlayer.value?.playerType === 'spectator';
  console.log('GameBoard - isSpectator:', result);
  return result;
});

// Check if the current user is the host
const isHost = computed(() => {
  return props.lobby?.hostUserId === myId;
});

// Helper function to get player name from ID
const getPlayerName = (playerId: string): string => {
	// First try to find the player in the props.players array by userId
	const playerByUserId = props.players.find(p => p.userId === playerId)
	if (playerByUserId?.name) {
		return playerByUserId.name
	}

	// Then try to find the player in the props.players array by $id
	// This handles cases where the playerId might be the player document ID instead of userId
	const playerById = props.players.find(p => p.$id === playerId)
	if (playerById?.name) {
		return playerById.name
	}

	// If not found, check if the playerId is in the state.players object
	if (state.value?.players && state.value.players[playerId]) {
		return state.value.players[playerId]
	}

	// If still not found, check if there's a player with a matching userId in submissions
	const submissionKeys = Object.keys(submissions.value || {})
	const matchingSubmission = submissionKeys.find(key => {
		const player = props.players.find(p => p.userId === key)
		return player && player.userId === playerId
	})

	if (matchingSubmission) {
		const player = props.players.find(p => p.userId === matchingSubmission)
		if (player?.name) {
			return player.name
		}
	}

	// If still not found, log the issue for debugging
	console.warn(`Player not found for ID: ${playerId}. Available players:`,
			props.players.map(p => ({id: p.userId, name: p.name, docId: p.$id})),
			'State players:', state.value?.players,
			'Submissions:', submissions.value)

	return "Unknown Player"
}

// Track which cards have been revealed (playerId -> boolean)
const revealedCards = ref<Record<string, boolean>>({})
// Store shuffled submissions to prevent re-shuffling on every render
const shuffledSubmissions = ref<any[]>([])

// Reset revealed cards and shuffle submissions when phase changes or submissions change
watch([isJudging, otherSubmissions], ([newIsJudging, newSubmissions]) => {
	if (newIsJudging) {
		revealedCards.value = {}

		// Shuffle submissions
		shuffledSubmissions.value = [...newSubmissions]
		// Fisher-Yates shuffle
		for (let i = shuffledSubmissions.value.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffledSubmissions.value[i], shuffledSubmissions.value[j]] =
					[shuffledSubmissions.value[j], shuffledSubmissions.value[i]]
		}
	}
}, {immediate: true})


// Check if all submissions are revealed
const allCardsRevealed = computed(() => {
	// If the user is the judge, always return true to skip the reveal process
	if (isJudge.value) {
		return true;
	}

	// Get all unique player IDs from shuffled submissions
	const playerIds = shuffledSubmissions.value.map(sub => sub.playerId);

	// Check if all player IDs are in the revealed cards object
	return playerIds.every(playerId => revealedCards.value[playerId]);
})

// Reveal only the clicked submission
async function revealCard(playerId: string) {
	console.log('🎮 revealCard called with playerId:', playerId);
	console.log('🎮 Current revealedCards:', JSON.stringify(revealedCards.value));
	console.log('🎮 Current props.lobby.revealedSubmissions:', props.lobby.revealedSubmissions);

	// Don't do anything if this card is already revealed
	if (revealedCards.value[playerId]) {
		console.log('🎮 Card already revealed, skipping');
		return;
	}

	// Update revealed cards in Appwrite
	try {
		const config = useRuntimeConfig();
		const {databases} = getAppwrite();

		// Get the current revealed submissions from the database
		let currentRevealedSubmissions = {};
		if (props.lobby.revealedSubmissions) {
			try {
				const parsedSubmissions = typeof props.lobby.revealedSubmissions === 'string'
						? JSON.parse(props.lobby.revealedSubmissions)
						: props.lobby.revealedSubmissions;

				console.log('🎮 Parsed current revealedSubmissions:', parsedSubmissions);

				// Filter out numeric indexes and only keep string player IDs
				// This ensures we don't mix numeric indexes with player IDs
				currentRevealedSubmissions = Object.entries(parsedSubmissions)
						.filter(([key]) => isNaN(Number(key)) || key.length > 5) // Player IDs are long strings
						.reduce((acc, [key, value]) => {
							acc[key] = value;
							return acc;
						}, {} as Record<string, boolean>);

				console.log('🎮 Filtered current revealedSubmissions:', currentRevealedSubmissions);
			} catch (parseErr) {
				console.error('Failed to parse current revealed submissions:', parseErr);
			}
		}

		// Update only the clicked submission
		const updatedRevealedSubmissions = {
			...currentRevealedSubmissions,
			[playerId]: true
		};

		console.log('🎮 Updating revealedSubmissions in database:', updatedRevealedSubmissions);

		// Update locally immediately for better UX
		// This provides instant feedback to the judge
		revealedCards.value = {...updatedRevealedSubmissions};
		console.log('🎮 Updated revealedCards locally before database update:', revealedCards.value);

		// Then update the database
		await databases.updateDocument(
				config.public.appwriteDatabaseId,
				config.public.appwriteLobbyCollectionId,
				props.lobby.$id,
				{
					revealedSubmissions: JSON.stringify(updatedRevealedSubmissions)
				}
		);

		console.log('🎮 Database update successful');

		// Ensure the local state is in sync with what we sent to the database
		// This is redundant but ensures consistency
		revealedCards.value = {...updatedRevealedSubmissions};
		console.log('🎮 Confirmed revealedCards after database update:', revealedCards.value);
	} catch (err) {
		console.error('Failed to update revealed submissions:', err);
		// Revert the local update if the database update failed
		if (props.lobby.revealedSubmissions) {
			try {
				const parsedReveals = typeof props.lobby.revealedSubmissions === 'string'
						? JSON.parse(props.lobby.revealedSubmissions) as Record<string, boolean>
						: props.lobby.revealedSubmissions as Record<string, boolean>;
				revealedCards.value = {...parsedReveals};
			} catch (parseErr) {
				console.error('Failed to revert local update:', parseErr);
			}
		}
	}
}


watch(() => props.lobby?.revealedSubmissions, (newReveals) => {
	console.log('🔄 Watch triggered for revealedSubmissions:', newReveals);
	if (newReveals) {
		try {
			// Parse the JSON string if it's a string, otherwise use as is
			const parsedReveals = typeof newReveals === 'string' ? JSON.parse(newReveals) : newReveals
			console.log('🔄 Parsed revealedSubmissions:', parsedReveals);

			// Filter out numeric indexes and only keep string player IDs
			// This ensures we don't mix numeric indexes with player IDs
			const filteredReveals = Object.entries(parsedReveals)
					.filter(([key]) => isNaN(Number(key)) || key.length > 5) // Player IDs are long strings
					.reduce((acc, [key, value]) => {
						acc[key] = value;
						return acc;
					}, {} as Record<string, boolean>);

			console.log('🔄 Filtered revealedSubmissions:', filteredReveals);

			// Force reactivity by creating a new object
			revealedCards.value = {...filteredReveals}
			console.log('🔄 Updated revealedCards from watch:', revealedCards.value)
		} catch (err) {
			console.error('Failed to parse revealed submissions:', err)
		}
	}
}, {immediate: true, deep: true})

// Add a separate watch for individual submissions to ensure reactivity
watch(shuffledSubmissions, () => {
	// When submissions change, ensure revealedCards is properly updated
	if (props.lobby?.revealedSubmissions) {
		try {
			const parsedReveals = typeof props.lobby.revealedSubmissions === 'string'
					? JSON.parse(props.lobby.revealedSubmissions)
					: props.lobby.revealedSubmissions;

			// Update revealedCards to match the current state
			revealedCards.value = {...parsedReveals};
			console.log('🔄 Updated revealedCards after submissions change:', revealedCards.value);
		} catch (err) {
			console.error('Failed to update revealed cards after submissions change:', err);
		}
	}
}, {deep: true})

function handleCardSubmit(cardIds: string[]) {
	playCard(props.lobby.$id, myId, cardIds)
}

// Track the winner and show notification
const winnerSelected = ref(false)
const countdownTimer = ref(10) // 10 seconds countdown
const countdownInterval = ref<NodeJS.Timeout | null>(null)


// Watch for changes to roundWinner to start countdown for all players
watch(() => state.value?.roundWinner, (newWinner) => {
	// Reset local round winner when state is updated from the server
	if (newWinner) {
		localRoundWinner.value = null
	}
	if (newWinner) {
		// First show the winning card and submitter name to all players
		// Play sound effect for all players
		playSfx('/sounds/sfx/selectWinner.wav', {pitch: [0.95, 1.05], volume: 0.75})

		// After a short delay, show the winner screen
		setTimeout(() => {
			winnerSelected.value = true

			// Show notification to the winner
			if (newWinner === myId) {
				notify({
					title: '🏆 You Won This Round!',
					description: 'You get a point!',
					color: 'success',
					icon: 'i-mdi-trophy',
					duration: 5000
				})
			}

			// Start countdown to next round for all players
			if (countdownInterval.value) {
				clearInterval(countdownInterval.value)
			}

			countdownTimer.value = 10
			countdownInterval.value = setInterval(() => {
				countdownTimer.value--
				if (countdownTimer.value <= 0) {
					clearInterval(countdownInterval.value as NodeJS.Timeout)
					// Reset for next round
					winnerSelected.value = false
					countdownTimer.value = 10
				}
			}, 1000)
		}, 3000) // 3 second delay to show the winning card animation
	}
})

// Create a local reactive variable to track the round winner
const localRoundWinner = ref<string | null>(null)

// Computed property that combines both state.roundWinner and localRoundWinner
const effectiveRoundWinner = computed(() => {
  return localRoundWinner.value || state.value?.roundWinner || null
})

function handleSelectWinner(playerId: string) {
	// First mark the winner locally to show the animation
	localRoundWinner.value = playerId

	// Update the database immediately so all players see the winning card
	// This will trigger the watch function for state.value?.roundWinner for all players
	selectWinner(props.lobby.$id, playerId)

	// Play sound effect for the judge only (other players will hear it from the watch function)
	playSfx('/sounds/sfx/selectWinner.wav', {pitch: [0.95, 1.05], volume: 0.75})

	// The watch function will handle showing the winner screen after a delay
}

// Clean up interval and subscriptions when component is unmounted
onUnmounted(() => {
	if (countdownInterval.value) {
		clearInterval(countdownInterval.value)
	}

	// Clean up game cards subscription
	if (gameCardsUnsubscribe) {
		gameCardsUnsubscribe()
	}
})

// Add function to convert spectator to participant
async function convertToParticipant(playerId: string) {
  if (!isHost.value) return;

  try {
    // 1. Update player type in database
    const playerDoc = props.players.find(p => p.userId === playerId);
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
      [Query.equal('lobbyId', props.lobby.$id)]
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
}

function handleLeave() {
	// Update Nuxt payload state to indicate the user is leaving
	const nuxtApp = useNuxtApp();
	nuxtApp.payload.state.selfLeaving = true;

	// Call the leaveLobby function from useLobby
	leaveLobby(props.lobby.$id, myId)
	// Emit the leave event to the parent component
	emit('leave')
}
</script>
<template>
	<div class="w-full bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen">
		<div class="absolute w-full inset-0 bg-[url('/img/textures/noise.png')] opacity-7 pointer-events-none"></div>

		<!-- Main Content -->
		<div class="flex-1 flex flex-col w-full">
			<header class="flex justify-between items-center backdrop-blur-xs p-8 border-b-1 border-slate-700/50">
				<div class="absolute top-0 left-1/2 transform -translate-x-1/2 bg-slate-700 px-4 py-2 rounded-b-xl shadow-lg">
					<div class="text-center">
						<h2 class="font-['Bebas_Neue'] text-3xl">Round <span class="text-success-300">{{ state?.round || 1 }}</span></h2>
						<p class="text-slate-300 font-['Bebas_Neue'] text-2xl">
							{{ isSubmitting ? 'SUBMISSION PHASE' : isJudging ? 'JUDGING PHASE' : 'WAITING...' }}
						</p>
						<p v-if="judgeId" class="text-amber-400 font-['Bebas_Neue'] text-xl">
							Judge: {{ getPlayerName(judgeId) }}
						</p>
					</div>
				</div>
			</header>

			<main class="flex-1 p-6 overflow-y-auto flex flex-col items-center">
				<!-- Game Board Area with Card Decks -->
				<div class="w-full max-w-6xl mx-auto mt-16 mb-8 flex justify-center items-start gap-16 relative">
					<!-- Black Card Deck -->
					<div class="relative w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72 aspect-[3/4] outline-2 outline-slate-400/25 outline-offset-16 outline-dashed rounded-xl">
						<!-- Stack effect with multiple cards -->
						<div  v-for="i in 5" :key="`black-stack-${i}`"
						     :style="{
                   position: 'absolute',
                   top: `${i * 2}px`,
                   left: `${i * 2}px`,
                   // transform: `rotate(${i - 2}deg)`,
                   zIndex: 5 - i
                 }"
						     class="w-full h-full -translate-x-2 -translate-y-2">
							<BlackCard
									:flipped="true"
									:three-deffect="false"
									:shine="false"
							/>
						</div>
						<!-- Top card (current black card) -->
						<div v-if="blackCard" class="absolute top-0 left-0 z-10 w-full h-full transform hover:translate-y-[-20px] hover:scale-105 -translate-x-2 -translate-y-2 transition-transform duration-300">
							<BlackCard
									v-if="blackCard"
									:card-id="blackCard.id"
									:flipped="false"
									:num-pick="blackCard.pick"
									:text="blackCard.text"
									:three-deffect="true"
							/>
						</div>
					</div>

					<!-- White Card Deck -->
					<div class="relative w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72 aspect-[3/4] outline-2 outline-slate-400/25 outline-offset-16 outline-dashed rounded-xl">
						<!-- Stack effect with multiple cards -->
						<div v-for="i in 5" :key="`white-stack-${i}`"
						     :style="{
                   position: 'absolute',
                   top: `${i * 2}px`,
                   left: `${i * 2}px`,
                   // transform: `rotate(${i - 2}deg)`,
                   zIndex: 5 - i
                 }"
						     class="w-full h-full -translate-x-2 -translate-y-2">
							<whiteCard
									:flipped="true"
									:threeDeffect="false"
									:shine="false"
									:backLogoUrl="'/img/ufp.svg'"
									:mask-url="'/img/textures/hexa.png'"
							/>
						</div>
					</div>
				</div>

				<!-- Submission Phase -->
				<div v-if="isSubmitting" class="w-full flex flex-col items-center">
					<div v-if="isJudge" class="text-center">
						<p class="uppercase font-['Bebas_Neue'] text-4xl font-bold">You are the Judge!</p>
						<p class="text-slate-400 font-['Bebas_Neue'] font-light">Waiting for players to submit cards...</p>
						<!-- See who already submitted -->
						<div v-if="Object.keys(submissions).length > 0" class="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
							<div v-for="playerId in Object.keys(submissions)" :key="playerId"
							     class="p-8 outline-2 outline-green-900 bg-slate-800 rounded-xl shadow-md text-center">
								<p class="font-bold text-white uppercase font-['Bebas_Neue'] text-3xl">{{ getPlayerName(playerId) }}</p>
								<p class="text-green-500 uppercase font-['Bebas_Neue'] text-xl font-medium">Submitted</p>
							</div>
						</div>

					</div>

					<div v-else>
						<div v-if="submissions[myId]" class="text-center">
							<p class="uppercase font-['Bebas_Neue'] text-4xl font-bold">You've submitted your cards!</p>
							<div class="flex justify-center gap-4">
								<whiteCard v-for="cardId in submissions[myId]" :key="cardId" :cardId="cardId"/>
							</div>
							<p class="mt-4 italic text-gray-500">Waiting for others...</p>
						</div>
						<!-- Participant view with UserHand -->
						<div v-if="blackCard && isParticipant && !submissions[myId]" class="w-full flex justify-center items-end bottom-0 fixed translate-x-[-50%] z-50">
							<UserHand 
								:cards="myHand" 
								:disabled="isJudge || !isSubmitting" 
								:cardsToSelect="blackCard?.pick || 1"
								@select-cards="handleCardSubmit"
							/>
						</div>

						<!-- Spectator view with message -->
						<div v-if="blackCard && isSpectator" class="w-full flex justify-center mt-8">
							<div class="spectator-message bg-slate-800 p-6 rounded-xl text-center max-w-md">
								<p class="text-xl mb-4">You are currently spectating this game.</p>
								<!-- Only show this button to the host -->
								<UButton 
									v-if="isHost" 
									@click="convertToParticipant(myId)"
									color="primary"
									icon="i-mdi-account-plus"
								>
									Deal In This Player
								</UButton>
							</div>
						</div>
					</div>



				</div>

				<!-- Judging Phase -->
				<div v-else-if="isJudging" class="mt-8 bg-slate-700/25 border-y-2 border-b-slate-700 border-t-slate-900 rounded-3xl p-8 text-center">
					<p v-if="!isJudge" class="text-center mb-6 text-slate-100 text-3xl font-['Bebas_Neue']">SUBMISSIONS</p>
					<!-- Judge view -->
					<div v-if="isJudge">
						<!-- Judge selecting a winner - all cards are shown directly -->
						<div>
							<p v-if="!winnerSelected"
							   class="text-center mb-6 text-slate-100 text-3xl font-['Bebas_Neue']">
								Select a Winner
							</p>

							<!-- Desktop view - hidden on mobile -->
							<div class="hidden xl:flex justify-center">
								<div class="flex flex-wrap justify-center gap-6 max-w-6xl w-full">
									<div
											v-for="sub in otherSubmissions"
											:key="sub.playerId"
											v-show="!effectiveRoundWinner || effectiveRoundWinner === sub.playerId"
											:class="{'border-2 border-green-500': effectiveRoundWinner === sub.playerId}"
											class="inset-shadow-sm inset-shadow-slate-900 flex flex-col items-center outline-2 outline-slate-400/15 rounded-3xl bg-slate-700/50 p-6"
									>
										<div class="inline-flex items-center justify-center gap-2 mb-4">
											<whiteCard
													v-for="cardId in sub.cards"
													:key="cardId"
													:cardId="cardId"
													:is-winner="effectiveRoundWinner === sub.playerId"
													:flipped="false"
											/>
										</div>
										<UButton
												v-if="!winnerSelected"
												class="w-full rounded-lg mt-2 cursor-pointer"
												color="secondary"
												size="lg"
												variant="solid"
												@click="handleSelectWinner(sub.playerId)"
										>
											<span
													class="text-white text-center w-full font-light text-xl font-['Bebas_Neue']">Select Winner</span>
										</UButton>
										<p v-else-if="effectiveRoundWinner === sub.playerId" class="text-green-400 font-bold mt-2">
											🏆 WINNER! 🏆
										</p>
									</div>
								</div>
							</div>

							<!-- Mobile view - scrollable cards in a box -->
							<div class="xl:hidden">
								<div class="overflow-y-auto max-h-[70vh] p-4 bg-slate-800/50 rounded-xl">
									<div class="flex flex-wrap justify-center gap-4">
										<div 
											v-for="sub in otherSubmissions" 
											:key="sub.playerId"
											v-show="!effectiveRoundWinner || effectiveRoundWinner === sub.playerId"
											:class="{'border-2 border-green-500': effectiveRoundWinner === sub.playerId}"
											class="inset-shadow-sm inset-shadow-slate-900 flex flex-col items-center outline-2 outline-slate-400/15 rounded-3xl bg-slate-700/50 p-6"
										>
											<div class="inline-flex items-center justify-center gap-2 mb-4">
												<whiteCard
													v-for="cardId in sub.cards"
													:key="cardId"
													:cardId="cardId"
													:is-winner="effectiveRoundWinner === sub.playerId"
													:flipped="false"
												/>
											</div>

											<UButton
												v-if="!winnerSelected"
												class="w-full rounded-lg mt-2 cursor-pointer"
												color="secondary"
												size="lg"
												variant="solid"
												@click="handleSelectWinner(sub.playerId)"
											>
												<span class="text-white text-center w-full font-light text-xl font-['Bebas_Neue']">
													Select Winner
												</span>
											</UButton>

											<p v-else-if="effectiveRoundWinner === sub.playerId" class="text-green-400 font-bold mt-2">
												🏆 WINNER! 🏆
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Other players view -->
					<div v-else class="flex justify-center space-x-8">
						<!-- Current player's submission (visible unless another player won) -->
						<div v-if="submissions[myId] && (!effectiveRoundWinner || effectiveRoundWinner === myId)" class="">
							<div class=" outline-2 outline-slate-400/25 outline-dashed rounded-3xl bg-slate-700/50 p-6">
								<p class="font-medium text-white mb-2 text-lg">
									<span class="text-success-400 font-['Bebas_Neue'] text-2xl">Your Submission</span>
								</p>
								<div class="inline-flex justify-center gap-2 mb-2">
									<whiteCard
											v-for="cardId in submissions[myId]"
											:key="cardId"
											:cardId="cardId"
											:is-winner="effectiveRoundWinner === myId"
											:flipped="false"
									/>
								</div>
								<p v-if="effectiveRoundWinner === myId" class="text-green-400 font-bold mt-2">
									🏆 YOU WON! 🏆
								</p>
							</div>
						</div>

						<!-- Other players' submissions -->
						<div v-if="shuffledSubmissions.length > 0" class="flex flex-wrap justify-center gap-8">
							<div
									v-for="(sub) in shuffledSubmissions"
									v-show="sub.playerId !== myId && (!effectiveRoundWinner || effectiveRoundWinner === sub.playerId)"
									:key="sub.playerId"
									:class="{'border-2 border-green-500': effectiveRoundWinner === sub.playerId}"
									class=" outline-2 outline-slate-400/25 outline-dashed rounded-3xl bg-slate-700/50 p-6"
							>
								<p v-if="effectiveRoundWinner === sub.playerId" class="font-medium text-amber-300 mb-2 font-['Bebas_Neue'] text-2xl">
									<span class="text-amber-400 ">Submitted by </span>{{ getPlayerName(sub.playerId) }}
								</p>
								<p v-else class="font-medium text-white mb-2 text-lg">
									<span class="text-amber-400 font-['Bebas_Neue'] text-2xl">Player Submission</span>
								</p>
								<div class="inline-flex justify-center gap-2 mb-2">
										<whiteCard
												v-for="cardId in sub.cards"
												:key="cardId"
												:cardId="cardId"
												:is-winner="effectiveRoundWinner === sub.playerId"
												:flipped="false"
										/>
								</div>
								<p v-if="effectiveRoundWinner === sub.playerId" class="text-green-400 font-bold mt-2">
									🏆 WINNER! 🏆
								</p>
							</div>
						</div>
						<p v-else class="text-center italic text-gray-500 mt-6">
							Waiting for submissions...</p>
					</div>
				</div>

				<!-- Game Over -->
				<div v-else-if="isComplete" class="text-center mt-10">
					<h3 class="text-2xl font-bold text-gray-100">🏁 Game Over</h3>
					<ul class="mt-6 space-y-2">
						<li v-for="entry in leaderboard" :key="entry.playerId" class="font-medium text-gray-400">
							{{ getPlayerName(entry.playerId) }} — {{ entry.points }} points
						</li>
					</ul>
				</div>

				<!-- Waiting State -->
				<div v-else class="text-center italic text-gray-500 mt-10">
					Waiting for game state...
				</div>
			</main>
		</div>
	</div>
</template>

<style scoped>
</style>
