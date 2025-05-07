<template>
	<div class="w-full">
		<!-- Main Content -->
		<div class="flex-1 flex flex-col w-full">
			<header class="flex justify-between items-center bg-gray-800/80 backdrop-blur-sm p-4">
				<div class="flex items-center space-x-3">
					<div
							class="rounded-full bg-emerald-600 text-white w-10 h-10 flex items-center justify-center font-bold shadow">
						{{ state?.round || 1 }}
					</div>
					<h2 class="text-2xl font-bold text-gray-100 tracking-wide">Round {{ state?.round || 1 }}</h2>
				</div>
			</header>

			<main class="flex-1 p-6 overflow-y-auto flex flex-col items-center">
				<!-- Black Card -->
				<div v-if="blackCard" class="flex justify-center mb-8">
					<BlackCard
							:card-id="blackCard.id"
							:flipped="false"
							:num-pick="blackCard.pick"
							:text="blackCard.text"
							:three-deffect="true"
					/>
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
						<UserHand
								v-else
								:cards="myHand"
								:cards-to-select="blackCard.pick"
								:disabled="!!submissions[myId]"
								@select-cards="handleCardSubmit"
						/>
					</div>
				</div>

				<!-- Judging Phase -->
				<div v-else-if="isJudging" class="w-full">
					<div class="text-center mb-8">
						<h3 class="uppercase font-['Bebas_Neue'] text-4xl font-bold">Judging Phase</h3>
						<p class="uppercase font-['Bebas_Neue'] text-2xl font-lightd text-slate-300 ">Judge: {{ getPlayerName(judgeId) }}</p>
					</div>

					<!-- Judge view -->
					<div v-if="isJudge">
						<!-- Judge selecting a winner - all cards are shown directly -->
						<div>
							<p v-if="!winnerSelected"
							   class="w-full text-center mb-6 font-semibold text-gray-100 text-4xl font-['Bebas_Neue'] bg-green-500/25 rounded-xl p-2">
								Select a Winner
							</p>
							<!-- Show all submitted cards to the judge -->
							<div class="flex justify-center">
								<div class="flex flex-wrap justify-center gap-6 max-w-6xl w-full">
									<div
											v-for="sub in otherSubmissions"
											:key="sub.playerId"
											:class="{'border-2 border-green-500': state?.roundWinner === sub.playerId}"
											class="p-6 bg-gray-800 rounded-xl shadow-md flex flex-col items-center"
									>
										<!--										<p class="font-medium text-white mb-4 text-xl font-['Bebas_Neue']">-->
										<!--											<span class="text-gray-500">Submitted by </span>{{ getPlayerName(sub.playerId) }}-->
										<!--										</p>-->
										<div class="inline-flex items-center justify-center gap-2 mb-4">
											<whiteCard
													v-for="cardId in sub.cards"
													:key="cardId"
													:cardId="cardId"
													:class="{'shadow-lg shadow-green-500/50': state?.roundWinner === sub.playerId}"
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
										<p v-else-if="state?.roundWinner === sub.playerId" class="text-green-400 font-bold mt-2">
											🏆 WINNER! 🏆
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Other players view -->
					<div v-else class="flex justify-center space-x-6">
						<!-- Current player's submission (always visible) -->
						<div v-if="submissions[myId]" class="">
							<div class="p-4 bg-gray-800 rounded-lg shadow-md flex flex-col items-center">
								<p class="font-medium text-white mb-2 text-lg">
									<span class="text-slate-300 font-['Bebas_Neue'] text-2xl">Your Submission</span>
								</p>
								<div class="inline-flex justify-center gap-2 mb-2">
									<whiteCard
											v-for="cardId in submissions[myId]"
											:key="cardId"
											:cardId="cardId"
											:class="{'border-2 border-green-500': state?.roundWinner === myId}"
											:flipped="false"
									/>
								</div>
								<p v-if="state?.roundWinner === myId" class="text-green-400 font-bold mt-2">
									🏆 YOU WON! 🏆
								</p>
							</div>
						</div>

						<!-- Other players' revealed submissions -->
						<div v-if="shuffledSubmissions.length > 0" class="flex flex-wrap justify-center gap-8">
							<div
									v-for="(sub) in shuffledSubmissions"
									v-show="revealedCards[sub.playerId] && sub.playerId !== myId"
									:key="sub.playerId"
									:class="{'border-2 border-green-500': state?.roundWinner === sub.playerId}"
									class="p-4 bg-gray-800 rounded-lg shadow-md flex flex-col items-center"
							>
								<p class="font-medium text-amber-300 mb-2 font-['Bebas_Neue'] text-2xl">
									<span class="text-slate-300 ">Submitted by </span>{{ getPlayerName(sub.playerId) }}
								</p>
								<div class="inline-flex justify-center gap-2 mb-2">
									<whiteCard
											v-for="cardId in sub.cards"
											:key="cardId"
											:cardId="cardId"
											:class="{'shadow-lg shadow-green-500/50': state?.roundWinner === sub.playerId}"
											:flipped="false"
									/>
								</div>
								<p v-if="state?.roundWinner === sub.playerId" class="text-green-400 font-bold mt-2">
									🏆 WINNER! 🏆
								</p>
							</div>
						</div>
						<p v-else-if="!state?.roundWinner && !submissions[myId]" class="text-center italic text-gray-500 mt-6">
							Waiting for the judge to reveal submissions...</p>
						<p v-else-if="!state?.roundWinner && submissions[myId] && Object.keys(revealedCards).filter(key => revealedCards[key] && key !== myId).length === 0"
						   class="text-center italic text-gray-500 mt-6">Waiting for the judge to reveal other submissions...</p>
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
import PlayerList from '~/components/game/PlayerList.vue'
import {getAppwrite} from "~/utils/appwrite";

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
						? JSON.parse(props.lobby.revealedSubmissions)
						: props.lobby.revealedSubmissions;
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
	if (newWinner) {
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
	}
})

function handleSelectWinner(playerId: string) {
	playSfx('/sounds/sfx/selectWinner.wav', {pitch: [0.95, 1.05], volume: 0.75}).then(() => {
		setTimeout(() => {
			selectWinner(props.lobby.$id, playerId)
			winnerSelected.value = true
		}, 1000)
	})
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

<style scoped>

</style>
