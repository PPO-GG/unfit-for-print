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
import WhiteCard from '~/components/game/WhiteCard.vue'
import {getAppwrite} from "~/utils/appwrite";
import {Query} from "appwrite";
import BlackCardDeck from '~/components/game/BlackCardDeck.vue'
import WhiteCardDeck from '~/components/game/WhiteCardDeck.vue'
import SubmissionPhase from '~/components/game/SubmissionPhase.vue'
import JudgingPhase from '~/components/game/JudgingPhase.vue'
import GameOver from '~/components/game/GameOver.vue'
import GameHeader from '~/components/game/GameHeader.vue';
import RoundEndOverlay from '~/components/game/RoundEndOverlay.vue';

const {t} = useI18n()
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
const {playerHands, fetchGameCards, subscribeToGameCards} = useGameCards()

// Variable to store the unsubscribe function
let gameCardsUnsubscribe: (() => void) | null = null;

// Subscribe to game cards updates when the component is mounted
onMounted(() => {
	if (props.lobby?.$id) {
		gameCardsUnsubscribe = subscribeToGameCards(props.lobby.$id, (cards) => {
			return
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
			return
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
        ,
        submissionStartTime,
        submissionCountdownDuration
} = useGameContext(lobbyRef, computed(() => playerHands.value))
const {playSfx} = useSfx();
const {playCard, selectWinner, endSubmissionPhase} = useGameActions()
const {leaveLobby} = useLobby()
const userStore = useUserStore()
const myId = userStore.user?.$id ?? ''
const {notify} = useNotifications()

const now = ref(Date.now())
let submissionTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
        submissionTimer = setInterval(() => {
                now.value = Date.now()
        }, 1000)
})

onUnmounted(() => {
        if (submissionTimer) clearInterval(submissionTimer)
})

const remainingSubmissionTime = computed(() => {
        if (!submissionStartTime.value) return submissionCountdownDuration.value
        const elapsed = now.value - submissionStartTime.value
        const remaining = submissionCountdownDuration.value * 1000 - elapsed
        return Math.max(0, Math.ceil(remaining / 1000))
})

watch(remainingSubmissionTime, (val) => {
        if (val === 0 && isHost.value && state.value?.phase === 'submitting') {
                endSubmissionPhase(props.lobby.$id)
        }
})

// Add computed properties to check player type
const currentPlayer = computed(() => {
	return props.players.find(p => p.userId === myId);
});

const isParticipant = computed(() => {
	return currentPlayer.value?.playerType === 'player' || !currentPlayer.value?.playerType;
});

const isSpectator = computed(() => {
	return currentPlayer.value?.playerType === 'spectator';
});

// Check if the current user is the host
const isHost = computed(() => lobbyRef.value?.hostId === myId);

// Add handler for when round is started
const handleRoundStarted = async () => {
    console.log('Round started, refreshing game state');
    if (props.lobby?.$id) {
        // Re-fetch game cards and update state
        await fetchGameCards(props.lobby.$id);
        // Play a sound effect if available
        playSfx('nextRound');
    }
};

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

	return t('lobby.unknown_player')
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
	// console.log('🎮 revealCard called with playerId:', playerId);
	// console.log('🎮 Current revealedCards:', JSON.stringify(revealedCards.value));
	// console.log('🎮 Current props.lobby.revealedSubmissions:', props.lobby.revealedSubmissions);

	// Don't do anything if this card is already revealed
	if (revealedCards.value[playerId]) {
		// console.log('🎮 Card already revealed, skipping');
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

				// console.log('🎮 Parsed current revealedSubmissions:', parsedSubmissions);

				// Filter out numeric indexes and only keep string player IDs
				// This ensures we don't mix numeric indexes with player IDs
				currentRevealedSubmissions = Object.entries(parsedSubmissions)
						.filter(([key]) => isNaN(Number(key)) || key.length > 5) // Player IDs are long strings
						.reduce((acc, [key, value]) => {
							acc[key] = value;
							return acc;
						}, {} as Record<string, boolean>);

				// console.log('🎮 Filtered current revealedSubmissions:', currentRevealedSubmissions);
			} catch (parseErr) {
				// console.error('Failed to parse current revealed submissions:', parseErr);
			}
		}

		// Update only the clicked submission
		const updatedRevealedSubmissions = {
			...currentRevealedSubmissions,
			[playerId]: true
		};

		// console.log('🎮 Updating revealedSubmissions in database:', updatedRevealedSubmissions);

		// Update locally immediately for better UX
		// This provides instant feedback to the judge
		revealedCards.value = {...updatedRevealedSubmissions};
		// console.log('🎮 Updated revealedCards locally before database update:', revealedCards.value);

		// Then update the database
		await databases.updateDocument(
				config.public.appwriteDatabaseId,
				config.public.appwriteLobbyCollectionId,
				props.lobby.$id,
				{
					revealedSubmissions: JSON.stringify(updatedRevealedSubmissions)
				}
		);

		// console.log('🎮 Database update successful');

		// Ensure the local state is in sync with what we sent to the database
		// This is redundant but ensures consistency
		revealedCards.value = {...updatedRevealedSubmissions};
		// console.log('🎮 Confirmed revealedCards after database update:', revealedCards.value);
	} catch (err) {
		// console.error('Failed to update revealed submissions:', err);
		// Revert the local update if the database update failed
		if (props.lobby.revealedSubmissions) {
			try {
				const parsedReveals = typeof props.lobby.revealedSubmissions === 'string'
						? JSON.parse(props.lobby.revealedSubmissions) as Record<string, boolean>
						: props.lobby.revealedSubmissions as Record<string, boolean>;
				revealedCards.value = {...parsedReveals};
			} catch (parseErr) {
				// console.error('Failed to revert local update:', parseErr);
			}
		}
	}
}


watch(() => props.lobby?.revealedSubmissions, (newReveals) => {
	// console.log('🔄 Watch triggered for revealedSubmissions:', newReveals);
	if (newReveals) {
		try {
			// Parse the JSON string if it's a string, otherwise use as is
			const parsedReveals = typeof newReveals === 'string' ? JSON.parse(newReveals) : newReveals
			// console.log('🔄 Parsed revealedSubmissions:', parsedReveals);

			// Filter out numeric indexes and only keep string player IDs
			// This ensures we don't mix numeric indexes with player IDs
			const filteredReveals = Object.entries(parsedReveals)
					.filter(([key]) => isNaN(Number(key)) || key.length > 5) // Player IDs are long strings
					.reduce((acc, [key, value]) => {
						acc[key] = value;
						return acc;
					}, {} as Record<string, boolean>);

			// console.log('🔄 Filtered revealedSubmissions:', filteredReveals);

			// Force reactivity by creating a new object
			revealedCards.value = {...filteredReveals}
			// console.log('🔄 Updated revealedCards from watch:', revealedCards.value)
		} catch (err) {
			// console.error('Failed to parse revealed submissions:', err)
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
			// console.log('🔄 Updated revealedCards after submissions change:', revealedCards.value);
		} catch (err) {
			// console.error('Failed to update revealed cards after submissions change:', err);
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
					title: t('game.round_won_self'),
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

// Add function to convert spectator to player
async function convertToPlayer(playerId: string) {
	if (!isHost.value) return;

	try {
		// 1. Update player type in database
		const playerDoc = props.players.find(p => p.userId === playerId);
		if (!playerDoc) return;

		const {databases} = getAppwrite();
		const config = useRuntimeConfig();

		await databases.updateDocument(
				config.public.appwriteDatabaseId,
				config.public.appwritePlayerCollectionId,
				playerDoc.$id,
				{
					playerType: 'player'
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
		const cardsPerPlayer = state.value?.config?.cardsPerPlayer || 10;

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
			parsedHands.push({playerId, cards: newHand});
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
			title: t('game.player_dealt_in'),
			description: t('game.player_dealt_in_description', {name: getPlayerName(playerId)}),
			color: 'success',
			icon: 'i-mdi-account-plus'
		});

	} catch (err) {
		// console.error('Failed to convert player to participant:', err);
		notify({
			title: t('game.error_player_dealt_in'),
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
	<div class="w-full bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen flex flex-col">
		<div class="absolute w-full inset-0 bg-[url('/img/textures/noise.png')] opacity-7 pointer-events-none"></div>

		<!-- Main Content -->
		<div class="min-h-screen flex flex-col">
                        <GameHeader
                                        :state="state"
                                        :is-submitting="isSubmitting"
                                        :is-judging="isJudging"
                                        :judge-id="judgeId"
                                        :players="props.players"
                                        :remaining-time="remainingSubmissionTime"
                                        :lobby-id="props.lobby.$id"
                        />

			<main class="flex-1 p-6 flex flex-col overflow-hidden">
				<!-- Game Board Area with Card Decks -->
				<div class="w-full max-w-6xl mx-auto mt-16 mb-6 flex justify-center items-start gap-8 md:gap-12">
					<!-- Black Card Deck -->
					<BlackCardDeck :black-card="blackCard" />

					<!-- White Card Deck -->
					<WhiteCardDeck />
				</div>

				<!-- Submission Phase -->
				<SubmissionPhase
						v-if="isSubmitting"
						:is-judge="isJudge"
						:submissions="submissions"
						:my-id="myId"
						:black-card="blackCard"
						:my-hand="myHand"
						:is-participant="isParticipant"
						:is-spectator="isSpectator"
						:is-host="isHost"
						:players="props.players"
						@select-cards="handleCardSubmit"
						@convert-to-player="convertToPlayer"
				/>

				<!-- Judging Phase -->
				<JudgingPhase
						v-else-if="isJudging"
						:is-judge="isJudge"
						:my-id="myId"
						:other-submissions="otherSubmissions"
						:submissions="submissions"
						:effective-round-winner="effectiveRoundWinner"
						:winner-selected="winnerSelected"
						:shuffled-submissions="shuffledSubmissions"
						:players="props.players"
						:revealed-cards="revealedCards"
						@select-winner="handleSelectWinner"
				/>


				<!-- Waiting State -->
				<div v-else class="text-center italic text-gray-500 mt-10">
					{{ t('game.waiting') }}
				</div>

				<!-- Round End Overlay -->
				<RoundEndOverlay
					v-if="winnerSelected"
					:lobby-id="props.lobby.$id"
					:winner-name="getPlayerName(state.value?.roundWinner || '')"
					:is-winner-self="state.value?.roundWinner === myId"
					:countdown-duration="countdownTimer"
					:start-time="winnerSelected ? Date.now() : null"
					:is-host="isHost"
					:document-id="props.lobby.$id"
					:winning-cards="state.value?.winningCards"
					:black-card="blackCard"
					@round-started="handleRoundStarted"
				/>
			</main>
		</div>
	</div>
</template>

<style scoped>
</style>
