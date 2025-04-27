<template>
	<div class="flex h-screen bg-gray-900 overflow-hidden">
		<!-- Sidebar -->
		<aside class="max-w-3/12 w-auto bg-gray-800 border-r border-gray-700 p-4 flex flex-col shadow-inner">
			<h2 class="text-xl font-semibold mb-4 text-gray-100">Players</h2>
			<div class="flex-1 overflow-y-auto">
				<PlayerList
						:players="props.players"
						:host-user-id="props.lobby.hostUserId"
						:lobby-id="props.lobby.$id"
						:judge-id="judgeId"
						:submissions="submissions"
						:game-phase="state?.phase"
						:scores="state?.scores"
				/>
			</div>
		</aside>

		<!-- Main Content -->
		<div class="flex-1 flex flex-col w-9/12">
			<header class="flex justify-between items-center bg-gray-800/80 backdrop-blur-sm p-4">
				<div class="flex items-center space-x-3">
					<div class="rounded-full bg-emerald-600 text-white w-10 h-10 flex items-center justify-center font-bold shadow">
						{{ state?.round || 1 }}
					</div>
					<h2 class="text-2xl font-bold text-gray-100 tracking-wide">Round {{ state?.round || 1 }}</h2>
				</div>
				<UButton class="bg-rose-500 hover:bg-rose-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md" @click="handleLeave">
					Leave Game
				</UButton>
			</header>

			<main class="flex-1 p-6 overflow-y-auto flex flex-col items-center">
				<!-- Black Card -->
				<div v-if="blackCard" class="flex justify-center mb-8">
					<BlackCard
							:text="blackCard.text"
							:num-pick="blackCard.pick"
							:card-id="blackCard.id"
							:flipped="false"
							:three-deffect="true"
					/>
				</div>

				<!-- Submission Phase -->
				<div v-if="isSubmitting" class="w-full flex flex-col items-center">
					<div v-if="isJudge" class="text-center space-y-6">
						<h3 class="text-xl font-bold text-gray-100">You are the Judge!</h3>
						<p class="text-gray-400">Waiting for players to submit cards...</p>
						<div v-if="Object.keys(submissions).length > 0" class="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
							<div v-for="(_, playerId) in submissions" :key="playerId" class="p-4 bg-gray-800 rounded-xl shadow-md text-center">
								<p class="font-medium text-gray-100">{{ getPlayerName(playerId) }}</p>
								<p class="text-sm text-gray-500">Submitted</p>
							</div>
						</div>
					</div>

					<div v-else>
						<div v-if="submissions[myId]" class="text-center">
							<p class="font-semibold text-gray-100 mb-4">You've submitted your cards!</p>
							<div class="flex justify-center gap-4">
								<whiteCard v-for="cardId in submissions[myId]" :key="cardId" :cardId="cardId" />
							</div>
							<p class="mt-4 italic text-gray-500">Waiting for others...</p>
						</div>
						<UserHand
								v-else
								:cards="myHand"
								:disabled="!!submissions[myId]"
								:cards-to-select="blackCard.pick"
								@select-cards="handleCardSubmit"
						/>
					</div>
				</div>

				<!-- Judging Phase -->
				<div v-else-if="isJudging" class="w-full">
					<div class="text-center mb-8">
						<h3 class="text-xl font-bold text-gray-100">Judging Phase</h3>
						<p class="text-gray-400">Judge: {{ getPlayerName(judgeId) }}</p>
					</div>

					<!-- Judge view -->
					<div v-if="isJudge">
						<!-- Judge flipping cards -->
						<div v-if="!allCardsRevealed">
							<p class="text-center text-gray-400 mb-6">Click a group to reveal it:</p>

							<div class="flex flex-wrap justify-center gap-8 max-w-6xl mx-auto transition-all duration-300">
								<div
										v-for="sub in shuffledSubmissions"
										:key="sub.playerId"
										class="flex flex-col items-center space-y-4 cursor-pointer transition-transform hover:scale-105"
										@click="isJudge ? revealCard(sub.playerId) : null"
								>
									<div class="inline-flex justify-center gap-2">
										<whiteCard
												v-for="cardId in sub.cards"
												:key="cardId"
												:cardId="cardId"
												:flipped="!revealedCards[sub.playerId]"
												:shine="true"
												:back-logo-url="'/img/unfit_logo_alt_dark.png'"
												:mask-url="'/img/textures/hexa2.png'"
										/>
									</div>

									<span v-if="revealedCards[sub.playerId]" class="text-xs text-green-400">Revealed</span>
								</div>
							</div>
						</div>

						<!-- Judge selecting a winner after reveal -->
						<div v-else>
							<div v-if="winnerSelected" class="text-center mb-8">
								<p class="text-2xl font-bold text-green-400 mb-4">
									Winner selected! Next round in {{ countdownTimer }} seconds...
								</p>
								<div class="w-full bg-gray-700 rounded-full h-2.5 mb-4">
									<div class="bg-green-500 h-2.5 rounded-full" :style="{ width: `${(countdownTimer / 10) * 100}%` }"></div>
								</div>
							</div>
							<p v-else class="w-full text-center mb-6 font-semibold text-gray-100 text-4xl font-['Bebas_Neue'] bg-green-500/25 rounded-xl p-2">
								Select a Winner
							</p>
							<div class="flex justify-center">
								<div class="flex flex-wrap justify-center gap-6 max-w-6xl w-full">
									<div
											v-for="sub in otherSubmissions"
											:key="sub.playerId"
											class="p-6 bg-gray-800 rounded-xl shadow-md flex flex-col items-center"
											:class="{'border-2 border-green-500': state?.roundWinner === sub.playerId}"
									>
										<p class="font-medium text-white mb-4 text-xl font-['Bebas_Neue']">
											<span class="text-gray-500">Submitted by </span>{{ getPlayerName(sub.playerId) }}
										</p>
										<div class="inline-flex items-center justify-center gap-2 mb-4">
											<whiteCard
													v-for="cardId in sub.cards"
													:key="cardId"
													:cardId="cardId"
													:flipped="false"
													:class="{'shadow-lg shadow-green-500/50': state?.roundWinner === sub.playerId}"
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
											<span class="text-white text-center w-full font-light text-xl font-['Bebas_Neue']">Select Winner</span>
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
					<div v-else>
						<!-- Show countdown timer for all players when winner is selected -->
						<div v-if="state?.roundWinner" class="text-center mb-8">
							<p class="text-2xl font-bold text-green-400 mb-4">
								Winner selected! Next round in {{ countdownTimer }} seconds...
							</p>
							<div class="w-full bg-gray-700 rounded-full h-2.5 mb-4">
								<div class="bg-green-500 h-2.5 rounded-full" :style="{ width: `${(countdownTimer / 10) * 100}%` }"></div>
							</div>
						</div>

						<!-- Other players see revealed cards -->
						<div v-if="shuffledSubmissions.length > 0" class="flex flex-wrap justify-center gap-8">
							<div
									v-for="(sub) in shuffledSubmissions"
									:key="sub.playerId"
									v-show="revealedCards[sub.playerId] && sub.playerId !== myId"
									class="p-4 bg-gray-800 rounded-lg shadow-md flex flex-col items-center"
									:class="{'border-2 border-green-500': state?.roundWinner === sub.playerId}"
							>
								<p class="font-medium text-white mb-2 text-lg">
									<span class="text-gray-500">Submitted by </span>{{ getPlayerName(sub.playerId) }}
								</p>
								<div class="inline-flex justify-center gap-2 mb-2">
									<whiteCard
											v-for="cardId in sub.cards"
											:key="cardId"
											:cardId="cardId"
											:flipped="false"
											:class="{'shadow-lg shadow-green-500/50': state?.roundWinner === sub.playerId}"
									/>
								</div>
								<p v-if="state?.roundWinner === sub.playerId" class="text-green-400 font-bold mt-2">
									🏆 WINNER! 🏆
								</p>
							</div>
						</div>
						<p v-else-if="!state?.roundWinner" class="text-center italic text-gray-500 mt-6">Waiting for the judge to reveal submissions...</p>
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


<script setup lang="ts">
import { ref, computed, onMounted, watch, type Ref, onUnmounted } from 'vue'
import type { Player } from '~/types/player'
import type { Lobby } from '~/types/lobby'
import { useGameContext } from '~/composables/useGameContext'
import { useGameActions } from '~/composables/useGameActions'
import { useUserStore } from '~/stores/userStore'
import { useLobby } from '~/composables/useLobby'
import { useNotifications } from '~/composables/useNotifications'
import UserHand from '~/components/game/UserHand.vue'
import whiteCard from '~/components/whiteCard.vue'
import PlayerList from '~/components/PlayerList.vue'
import {getAppwrite} from "~/utils/appwrite";

const props = defineProps<{ lobby: Lobby; players: Player[] }>()
const emit = defineEmits<{
  (e: 'leave'): void
}>()

const lobbyRef = ref(props.lobby)
// Keep lobbyRef in sync with props.lobby
watch(() => props.lobby, (newLobby) => {
  lobbyRef.value = newLobby
}, { immediate: true })

// Real-time updates are now handled by the parent component ([code].vue)

const { state, isSubmitting, isJudging, isComplete, isJudge, myHand, submissions, otherSubmissions, judgeId, blackCard, leaderboard, hands } = useGameContext(lobbyRef)
const { playCard, selectWinner } = useGameActions()
const { leaveLobby } = useLobby()
const userStore = useUserStore()
const myId = userStore.user?.$id ?? ''
const { notify } = useNotifications()

// Helper function to get player name from ID
const getPlayerName = (playerId: string): string => {
  const player = props.players.find(p => p.userId === playerId)
  return player?.name || "Unknown Player"
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
}, { immediate: true })


// Check if all submissions are revealed
const allCardsRevealed = computed(() => {
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
		const { databases } = getAppwrite();

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

		await databases.updateDocument(
				config.public.appwriteDatabaseId,
				config.public.appwriteLobbyCollectionId,
				props.lobby.$id,
				{
					revealedSubmissions: JSON.stringify(updatedRevealedSubmissions)
				}
		);

		console.log('🎮 Database update successful');

		// After successful update, update locally as a fallback
		// The watch on props.lobby?.revealedSubmissions should handle this via realtime
		// but we'll update it here as well just in case
		revealedCards.value = { ...updatedRevealedSubmissions };
		console.log('🎮 Updated revealedCards locally after database update:', revealedCards.value);
	} catch (err) {
		console.error('Failed to update revealed submissions:', err)
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
			revealedCards.value = { ...filteredReveals }
			console.log('🔄 Updated revealedCards from watch:', revealedCards.value)
		} catch (err) {
			console.error('Failed to parse revealed submissions:', err)
		}
	}
}, { immediate: true, deep: true })

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
  selectWinner(props.lobby.$id, playerId)
  winnerSelected.value = true
}

// Clean up interval when component is unmounted
onUnmounted(() => {
  if (countdownInterval.value) {
    clearInterval(countdownInterval.value)
  }
})

function handleLeave() {
  // Call the leaveLobby function from useLobby
  leaveLobby(props.lobby.$id, myId)
  // Emit the leave event to the parent component
  emit('leave')
}
</script>

<style scoped>

</style>
